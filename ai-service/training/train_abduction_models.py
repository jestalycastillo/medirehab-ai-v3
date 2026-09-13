import os
import shutil
import csv
import time
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from ultralytics import YOLO
import cv2

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AI_SERVICE_DIR = os.path.dirname(BASE_DIR)
YOLO_MODEL_PATH = os.path.join(BASE_DIR, "yolo26s-pose.pt")
if not os.path.exists(YOLO_MODEL_PATH):
    YOLO_MODEL_PATH = os.path.join(AI_SERVICE_DIR, "yolo26s-pose.pt")
CHECKPOINTS_DIR = os.path.join(BASE_DIR, "checkpoints")
APP_MODELS_DIR = os.path.join(AI_SERVICE_DIR, "app", "models")

LEFT_VIDEO_DIR = os.path.join(AI_SERVICE_DIR, "data", "left_abduction")
RIGHT_VIDEO_DIR = os.path.join(AI_SERVICE_DIR, "data", "right_abduction")

LEFT_CSV_DIR = os.path.join(AI_SERVICE_DIR, "data", "left_abduction_csv")
RIGHT_CSV_DIR = os.path.join(AI_SERVICE_DIR, "data", "right_abduction_csv")

os.makedirs(CHECKPOINTS_DIR, exist_ok=True)
os.makedirs(APP_MODELS_DIR, exist_ok=True)

BODY_PARTS = [
    "Nose", "Left Eye", "Right Eye", "Left Ear", "Right Ear",
    "Left Shoulder", "Right Shoulder",
    "Left Elbow", "Right Elbow",
    "Left Wrist", "Right Wrist",
    "Left Hip", "Right Hip",
    "Left Knee", "Right Knee",
    "Left Ankle", "Right Ankle"
]

# Keep indices: Left Shoulder(5), Right Shoulder(6), Left Elbow(7), Right Elbow(8)
KEEP_INDICES = [5, 6, 7, 8]
FEATURE_NAMES = (
    "Left Shoulder_x", "Left Shoulder_y",
    "Right Shoulder_x", "Right Shoulder_y",
    "Left Elbow_x", "Left Elbow_y",
    "Right Elbow_x", "Right Elbow_y",
)

TARGET_FRAMES = 200
EPOCHS = 100
BATCH_SIZE = 8
LR = 0.001

# -----------------------------------------------------------------------------
# 1. Pose Extraction (Video -> CSV)
# -----------------------------------------------------------------------------
def extract_keypoints_from_videos(video_folder, output_csv_folder, yolo_model):
    os.makedirs(output_csv_folder, exist_ok=True)
    video_files = sorted([f for f in os.listdir(video_folder) if f.endswith((".mp4", ".avi", ".mov", ".mkv"))])
    print(f"\n--- Extracting Pose Keypoints from {len(video_files)} videos in {video_folder} ---")

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    extract_batch_size = 32

    for idx, filename in enumerate(video_files):
        video_path = os.path.join(video_folder, filename)
        output_csv_path = os.path.join(output_csv_folder, f"seq{idx + 1}.csv")

        if os.path.exists(output_csv_path) and os.path.getsize(output_csv_path) > 100:
            print(f"[{idx+1}/{len(video_files)}] Already extracted: {filename} -> {output_csv_path}")
            continue

        print(f"[{idx+1}/{len(video_files)}] Processing {filename}...")
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"  Warning: Could not open {filename}")
            continue

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if width <= 0 or height <= 0:
            cap.release()
            continue

        frames_buffer = []
        frame_ids_buffer = []
        frame_id = 0

        with open(output_csv_path, "w", newline="") as file:
            writer = csv.writer(file)
            header = ["frame"]
            for k_idx in KEEP_INDICES:
                part = BODY_PARTS[k_idx]
                header += [f"{part}_x", f"{part}_y", f"{part}_conf"]
            writer.writerow(header)

            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                frames_buffer.append(frame)
                frame_ids_buffer.append(frame_id)
                frame_id += 1

                if len(frames_buffer) >= extract_batch_size:
                    results = yolo_model(frames_buffer, device=device, verbose=False)
                    for f_id, res in zip(frame_ids_buffer, results):
                        keypoints = res.keypoints
                        if keypoints is not None and keypoints.xy is not None and len(keypoints.xy) > 0:
                            xy = keypoints.xy[0]
                            conf = keypoints.conf[0] if keypoints.conf is not None else None
                            row = [f_id]
                            for k_idx in KEEP_INDICES:
                                x = xy[k_idx][0].item() / width
                                y = xy[k_idx][1].item() / height
                                c = conf[k_idx].item() if conf is not None else 1.0
                                row += [x, y, c]
                            writer.writerow(row)
                    frames_buffer.clear()
                    frame_ids_buffer.clear()

            if frames_buffer:
                results = yolo_model(frames_buffer, device=device, verbose=False)
                for f_id, res in zip(frame_ids_buffer, results):
                    keypoints = res.keypoints
                    if keypoints is not None and keypoints.xy is not None and len(keypoints.xy) > 0:
                        xy = keypoints.xy[0]
                        conf = keypoints.conf[0] if keypoints.conf is not None else None
                        row = [f_id]
                        for k_idx in KEEP_INDICES:
                            x = xy[k_idx][0].item() / width
                            y = xy[k_idx][1].item() / height
                            c = conf[k_idx].item() if conf is not None else 1.0
                            row += [x, y, c]
                        writer.writerow(row)

        cap.release()
        print(f"  Saved {frame_id} frames -> {output_csv_path}")

# -----------------------------------------------------------------------------
# 2. Sequence Preprocessing & Normalization
# -----------------------------------------------------------------------------
def resample_sequence(sequence, target_frames=200):
    original_frames = sequence.shape[0]
    num_features = sequence.shape[1]

    if original_frames < 2:
        return np.repeat(sequence, target_frames, axis=0)[:target_frames]

    x_old = np.arange(original_frames)
    x_new = np.linspace(0, original_frames - 1, target_frames)
    resampled = np.zeros((target_frames, num_features), dtype=np.float32)

    for i in range(num_features):
        resampled[:, i] = np.interp(x_new, x_old, sequence[:, i])

    return resampled

def normalize_pose(df):
    center_x = (df["Left Shoulder_x"] + df["Right Shoulder_x"]) / 2
    center_y = (df["Left Shoulder_y"] + df["Right Shoulder_y"]) / 2

    sw_per_frame = np.sqrt(
        (df["Left Shoulder_x"] - df["Right Shoulder_x"]) ** 2 +
        (df["Left Shoulder_y"] - df["Right Shoulder_y"]) ** 2
    )

    shoulder_width = np.median(sw_per_frame)
    if not np.isfinite(shoulder_width) or shoulder_width < 1e-6:
        shoulder_width = 1e-6

    for col in df.columns:
        if col.endswith("_x"):
            df[col] = (df[col] - center_x) / shoulder_width
        elif col.endswith("_y"):
            df[col] = (df[col] - center_y) / shoulder_width

    return df

def prepare_dataset(csv_folder):
    dataset = []
    files = sorted([f for f in os.listdir(csv_folder) if f.endswith(".csv")])

    for file in files:
        file_path = os.path.join(csv_folder, file)
        seq = pd.read_csv(file_path)
        if len(seq) < 5:
            continue

        if "frame" in seq.columns:
            seq = seq.drop(columns=["frame"])

        conf_cols = [c for c in seq.columns if "conf" in c.lower()]
        seq = seq.drop(columns=conf_cols)

        seq = normalize_pose(seq)
        seq_np = seq.to_numpy(dtype=np.float32)
        seq_resampled = resample_sequence(seq_np, target_frames=TARGET_FRAMES)
        dataset.append(seq_resampled)

    dataset = np.array(dataset, dtype=np.float32)
    print(f"Loaded {len(dataset)} sequences of shape {dataset.shape[1:]} from {csv_folder}")

    train, temp = train_test_split(dataset, test_size=0.30, random_state=42, shuffle=True)
    val, test = train_test_split(temp, test_size=0.50, random_state=42, shuffle=True)

    input_dim = dataset.shape[2]
    return train, val, test, input_dim

# -----------------------------------------------------------------------------
# 3. Model Architecture (PoseAutoEncoder)
# -----------------------------------------------------------------------------
class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=500):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-torch.log(torch.tensor(10000.0)) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x):
        return x + self.pe[:, :x.size(1)]

class PoseAutoEncoder(nn.Module):
    def __init__(self, input_dim):
        super().__init__()
        self.linear = nn.Linear(input_dim, 128)
        self.layernorm = nn.LayerNorm(128)
        self.position = PositionalEncoding(128)
        encoder_layer = nn.TransformerEncoderLayer(d_model=128, nhead=8, dropout=0.2, batch_first=True)
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=2)
        self.bottleneck_encode = nn.Linear(128, 64)
        self.bottleneck_decode = nn.Linear(64, 128)
        self.decoder = nn.Linear(128, input_dim)

    def forward(self, x):
        x = self.linear(x)
        x = self.layernorm(x)
        x = self.position(x)
        x = self.transformer(x)
        x = F.relu(self.bottleneck_encode(x))
        x = F.relu(self.bottleneck_decode(x))
        return self.decoder(x)

# -----------------------------------------------------------------------------
# 4. Training Loop & Calibration
# -----------------------------------------------------------------------------
def train_model(train_data, val_data, input_dim, model_name):
    print(f"\n=== Training Model: {model_name} (input_dim={input_dim}) ===")
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Using device: {device}")

    model = PoseAutoEncoder(input_dim).to(device)
    train_tensor = torch.tensor(train_data, dtype=torch.float32)
    val_tensor = torch.tensor(val_data, dtype=torch.float32)

    train_loader = DataLoader(TensorDataset(train_tensor), batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(TensorDataset(val_tensor), batch_size=BATCH_SIZE, shuffle=False)

    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    criterion = nn.MSELoss()

    best_val_loss = float("inf")
    best_state = None
    cal_mean = 0.0
    cal_beta = 1.0

    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0.0
        for (batch,) in train_loader:
            batch = batch.to(device)
            optimizer.zero_grad()
            output = model(batch)
            loss = criterion(output, batch)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        train_loss /= len(train_loader)

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for (batch,) in val_loader:
                batch = batch.to(device)
                output = model(batch)
                loss = criterion(output, batch)
                val_loss += loss.item()
        val_loss /= len(val_loader)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.cpu() for k, v in model.state_dict().items()}

            # Calibration stats
            cal_errors = []
            with torch.no_grad():
                for sample in train_tensor:
                    s = sample.unsqueeze(0).to(device)
                    out = model(s)
                    cal_errors.append(torch.mean((out - s) ** 2).item())
                for sample in val_tensor:
                    s = sample.unsqueeze(0).to(device)
                    out = model(s)
                    cal_errors.append(torch.mean((out - s) ** 2).item())

            cal_mean = float(np.mean(cal_errors))
            cal_std = float(np.std(cal_errors))
            if cal_std < 1e-4:
                cal_std = 1e-4
            k = 3.0
            cal_beta = float(np.log(2.0) / (k * cal_std))

        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(f"Epoch {epoch+1:03d}/{EPOCHS} | Train Loss: {train_loss:.6f} | Val Loss: {val_loss:.6f} | Best Val: {best_val_loss:.6f}")

    checkpoint_payload = {
        "model": best_state,
        "best_val_loss": best_val_loss,
        "mean_val_loss": cal_mean,
        "std_val_loss": cal_std,
        "beta": cal_beta,
        "features": FEATURE_NAMES,
        "input_frames": TARGET_FRAMES,
    }

    # Save to checkpoints and app/models
    ckpt_path = os.path.join(CHECKPOINTS_DIR, f"{model_name}.pth")
    app_model_path = os.path.join(APP_MODELS_DIR, f"{model_name}.pth")
    torch.save(checkpoint_payload, ckpt_path)
    torch.save(checkpoint_payload, app_model_path)
    print(f"\n✓ Saved {model_name} checkpoint to {ckpt_path} and {app_model_path}")
    print(f"  Mean Val Loss: {cal_mean:.6f}, Beta: {cal_beta:.4f}, Best Val Loss: {best_val_loss:.6f}")

    return model, checkpoint_payload

def evaluate_test_set(model, test_data, cal_mean, cal_beta):
    device = next(model.parameters()).device
    model.eval()
    print("\n--- Test Set Evaluation ---")
    with torch.no_grad():
        for idx, sample in enumerate(test_data):
            s = torch.tensor(sample, dtype=torch.float32).unsqueeze(0).to(device)
            out = model(s)
            error = torch.mean((out - s) ** 2).item()
            if error <= cal_mean:
                score = 100.0
            else:
                score = float(np.clip(100.0 * np.exp(-cal_beta * (error - cal_mean)), 0.0, 100.0))
            print(f"  Test Seq {idx+1:02d} | Recon Error: {error:.6f} | Similarity Score: {score:.2f}%")

# -----------------------------------------------------------------------------
# Main Execution
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"Loading YOLO pose model from {YOLO_MODEL_PATH}...")
    yolo_model = YOLO(YOLO_MODEL_PATH)

    # 1. Extract Left Abduction & Right Abduction videos to CSV
    extract_keypoints_from_videos(LEFT_VIDEO_DIR, LEFT_CSV_DIR, yolo_model)
    extract_keypoints_from_videos(RIGHT_VIDEO_DIR, RIGHT_CSV_DIR, yolo_model)

    # 2. Train Left Abduction Model
    left_train, left_val, left_test, left_dim = prepare_dataset(LEFT_CSV_DIR)
    left_model, left_ckpt = train_model(left_train, left_val, left_dim, "left_abduction")
    evaluate_test_set(left_model, left_test, left_ckpt["mean_val_loss"], left_ckpt["beta"])

    # 3. Train Right Abduction Model
    right_train, right_val, right_test, right_dim = prepare_dataset(RIGHT_CSV_DIR)
    right_model, right_ckpt = train_model(right_train, right_val, right_dim, "right_abduction")
    evaluate_test_set(right_model, right_test, right_ckpt["mean_val_loss"], right_ckpt["beta"])

    print("\n==================================================================")
    print("SUCCESS: Trained and saved both models (left_abduction / right_abduction)!")
    print("==================================================================")
