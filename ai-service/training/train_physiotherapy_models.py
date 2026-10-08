"""Train four independent shoulder autoencoders without changing live models.

Use --inspect for a dependency-free dataset/split audit. Real training requires
the existing ai-service environment and writes only to a new training run folder.
"""

import argparse
import csv
import json
import math
import random
import re
import sys
from datetime import datetime
from pathlib import Path
from uuid import uuid4

SERVICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE))
from app.pose_features import EXERCISE_FEATURES

DATASETS = {
    "arm_circumduction": "Arm_Circumduction",
    "cross_body_shoulder_stretch": "cross-body_shoulder_stretch",
    "external_rotation": "external-rotation",
    "internal_rotation": "internal-rotation",
}
COMBINED = {"arm_circumduction", "cross_body_shoulder_stretch"}


def dataset_records(root, exercise):
    videos = sorted((root / DATASETS[exercise]).rglob("*.mp4"))
    if not videos:
        raise ValueError(f"No videos found for {exercise}")
    records = []
    for path in videos:
        if exercise in COMBINED:
            side = path.parent.name.lower()
            if side not in ("left", "right"):
                raise ValueError(f"Missing LEFT/RIGHT folder: {path}")
            # Pair matching recording numbers; these are NOT verified subjects.
            group = "recording_pair_" + path.stem.rsplit("_", 1)[1]
            view = None
        else:
            match = re.fullmatch(r"E\d+_(P\d+)_(AF|AL|AR)_VFL_GM", path.stem)
            if match is None:
                raise ValueError(f"Unknown rotation naming scheme: {path.name}")
            group, view = match.groups()
            side = "unverified"
        records.append({"path": str(path), "group": group, "side": side, "view": view})
    return records


def split_groups(records, seed):
    groups = sorted({record["group"] for record in records})
    if len(groups) < 5:
        raise ValueError("At least five independent groups are required.")
    random.Random(seed).shuffle(groups)
    test_count = max(1, math.ceil(len(groups) * 0.15))
    val_count = max(1, math.ceil(len(groups) * 0.15))
    assignment = {group: "test" for group in groups[:test_count]}
    assignment.update({group: "validation" for group in groups[test_count:test_count + val_count]})
    assignment.update({group: "train" for group in groups[test_count + val_count:]})
    return [{**record, "split": assignment[record["group"]]} for record in records]


def canonicalize_right(trace):
    """Reflect a right-arm trace into the left-arm reference convention."""
    trace = trace.copy()
    for column in trace.columns:
        if column.endswith("_x"):
            trace[column] = 1.0 - trace[column]
    for joint in ("Shoulder", "Elbow", "Wrist"):
        for axis in ("x", "y"):
            left, right = f"Left {joint}_{axis}", f"Right {joint}_{axis}"
            left_values, right_values = trace[left].copy(), trace[right].copy()
            trace[left], trace[right] = right_values, left_values
    return trace


def write_json(path, payload):
    path.write_text(json.dumps(payload, indent=2, allow_nan=False), encoding="utf-8")


def train_exercise(exercise, records, run_dir, args, torch, np):
    import pandas as pd
    from torch.utils.data import DataLoader, TensorDataset
    from app.utils.build_model import build_model
    from app.utils.preprocess import preprocess
    from app.utils.process_video import process_video_to_csv

    features = EXERCISE_FEATURES[exercise]
    folder = run_dir / exercise
    folder.mkdir()
    trace_dir = folder / "traces"
    trace_dir.mkdir()
    write_json(folder / "split_manifest.json", records)
    samples = {name: [] for name in ("train", "validation", "test")}
    sample_records = {name: [] for name in samples}
    rejected = []
    for index, record in enumerate(records):
        print(f"[{exercise}] Extract {index + 1}/{len(records)}: {Path(record['path']).name}", flush=True)
        trace_path = trace_dir / f"{index:03d}_raw.csv"
        summary = process_video_to_csv(record["path"], str(trace_path), features)
        try:
            if summary.pose_frames < 15:
                raise ValueError("Fewer than 15 pose frames")
            trace = pd.read_csv(trace_path)
            # Missing YOLO joints are commonly represented as zero coordinates.
            for joint in ("Nose", "Left Shoulder", "Right Shoulder", "Left Elbow", "Right Elbow", "Left Wrist", "Right Wrist"):
                absent = (trace[f"{joint}_x"] == 0) & (trace[f"{joint}_y"] == 0)
                if absent.mean() > 0.2:
                    raise ValueError(f"{joint} missing in more than 20% of pose frames")
            if exercise in COMBINED and record["side"] == "right":
                trace = canonicalize_right(trace)
            canonical_path = trace_dir / f"{index:03d}_input.csv"
            trace.to_csv(canonical_path, index=False)
            data, _ = preprocess(canonical_path, target_frames=200, expected_features=features)
            samples[record["split"]].append(data[0])
            sample_records[record["split"]].append(record)
        except ValueError as error:
            rejected.append({**record, "reason": str(error)})
            print(f"  Rejected: {error}", flush=True)
    write_json(folder / "rejected.json", rejected)
    if any(not values for values in samples.values()):
        raise ValueError(f"A split has no usable videos for {exercise}; see rejected.json")
    tensors = {name: torch.tensor(np.array(values), dtype=torch.float32) for name, values in samples.items()}
    loader = DataLoader(TensorDataset(tensors["train"]), batch_size=args.batch_size, shuffle=True)
    model = build_model(len(features)).to(args.device)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    best_loss, best_epoch, best_state = float("inf"), None, None

    def errors(tensor):
        model.eval()
        values = []
        with torch.no_grad():
            for batch in tensor.split(args.batch_size):
                batch = batch.to(args.device)
                values.extend(((model(batch) - batch) ** 2).mean(dim=(1, 2)).cpu().tolist())
        return values

    with (folder / "epochs.csv").open("w", newline="", encoding="utf-8") as log:
        writer = csv.writer(log)
        writer.writerow(("epoch", "train_loss", "validation_loss"))
        for epoch in range(args.epochs):
            model.train()
            total_loss = 0.0
            for (batch,) in loader:
                batch = batch.to(args.device)
                optimizer.zero_grad()
                loss = ((model(batch) - batch) ** 2).mean()
                loss.backward()
                optimizer.step()
                total_loss += loss.item() * len(batch)
            train_loss = total_loss / len(tensors["train"])
            val_loss = float(np.mean(errors(tensors["validation"])))
            writer.writerow((epoch + 1, train_loss, val_loss))
            log.flush()
            if not math.isfinite(train_loss + val_loss):
                raise ValueError("Non-finite training loss")
            if val_loss < best_loss:
                best_loss, best_epoch = val_loss, epoch + 1
                best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
            print(f"[{exercise}] Epoch {epoch + 1}/{args.epochs} train={train_loss:.6f} validation={val_loss:.6f}", flush=True)
    model.load_state_dict(best_state)
    calibration = errors(tensors["validation"])
    mean_error = float(np.mean(calibration))
    std_error = max(float(np.std(calibration)), 1e-4)
    beta = float(np.log(2.0) / (3.0 * std_error))
    payload = {
        "model": best_state, "features": features, "input_frames": 200,
        "best_val_loss": best_loss, "best_epoch": best_epoch,
        "mean_val_loss": mean_error, "std_val_loss": std_error, "beta": beta,
        "exercise": exercise, "seed": args.seed,
        "normalization": "chest_origin_median_shoulder_width",
        "canonical_side": "left" if exercise in COMBINED else None,
        "side_transform": "reflect_x_swap_shoulders_elbows_wrists" if exercise in COMBINED else None,
    }
    checkpoint_path = folder / f"{exercise}.pth"
    torch.save(payload, checkpoint_path)
    # Verify the saved checkpoint uses the production architecture and exact tensor dimensions.
    verified = build_model(len(features)).to(args.device)
    verified.load_state_dict(torch.load(checkpoint_path, map_location=args.device, weights_only=True)["model"])
    verified.eval()
    with torch.no_grad():
        if not torch.isfinite(verified(tensors["test"][:1].to(args.device))).all():
            raise ValueError("Saved checkpoint produced invalid outputs")
    rows = []
    for split in samples:
        for record, error in zip(sample_records[split], errors(tensors[split])):
            rows.append({**record, "reconstruction_error": error,
                         "similarity_score": float(100.0 * np.exp(-beta * max(0.0, error - mean_error)))})
    report = {"checkpoint": str(checkpoint_path), "best_epoch": best_epoch,
              "best_validation_loss": best_loss, "split_counts": {name: len(values) for name, values in samples.items()},
              "rejected_count": len(rejected), "sequences": rows,
              "limitations": ["Reconstruction similarity is not validated clinical accuracy.",
                              "Numbered recording pairs are not verified participant identities." if exercise in COMBINED
                              else "Arm labels are unverified; AF/AL/AR are preserved as view codes."]}
    write_json(folder / "evaluation.json", report)
    print(f"[{exercise}] SAVED {checkpoint_path}", flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", type=Path, default=Path(r"C:\proj\medirehab\Physiotherapy"))
    parser.add_argument("--output-root", type=Path, default=SERVICE / "training" / "runs")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", choices=("auto", "cuda", "cpu"), default="auto")
    parser.add_argument("--inspect", action="store_true")
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1:
        parser.error("epochs and batch-size must be positive")
    datasets = {exercise: split_groups(dataset_records(args.data_root, exercise), args.seed) for exercise in DATASETS}
    for exercise, records in datasets.items():
        counts = {split: sum(record["split"] == split for record in records) for split in ("train", "validation", "test")}
        print(f"{exercise}: {len(records)} videos, {counts}, {len(EXERCISE_FEATURES[exercise])} features", flush=True)
    if args.inspect:
        return
    # Import preflight before creating run outputs. Never repair OS policy here.
    import torch
    import numpy as np
    from app.utils.process_video import pose_model
    args.device = ("cuda" if torch.cuda.is_available() else "cpu") if args.device == "auto" else args.device
    if args.device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is unavailable")
    print(f"Training device: {args.device}", flush=True)
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    pose_model.to(args.device)
    run_dir = args.output_root / f"{datetime.now():%Y%m%d_%H%M%S}_{uuid4().hex[:8]}"
    run_dir.mkdir(parents=True)
    write_json(run_dir / "config.json", {**vars(args), "data_root": str(args.data_root), "output_root": str(args.output_root)})
    status = {}
    for exercise, records in datasets.items():
        try:
            report = train_exercise(exercise, records, run_dir, args, torch, np)
            status[exercise] = {"status": "complete", "checkpoint": report["checkpoint"]}
        except Exception as error:
            status[exercise] = {"status": "failed", "error": str(error)}
            print(f"[{exercise}] FAILED: {error}", flush=True)
        write_json(run_dir / "status.json", status)
    print(f"Run results: {run_dir}", flush=True)
    if any(result["status"] != "complete" for result in status.values()):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
