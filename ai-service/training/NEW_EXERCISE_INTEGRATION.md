# Four new shoulder models

Batch runner: `venv\Scripts\python.exe training\train_physiotherapy_models.py`.
Use `--inspect` to audit datasets/splits without loading PyTorch. Defaults:
100 epochs, batch size 4, seed 42, automatic CUDA selection. It creates a
unique folder under `training/runs` with four separate checkpoint folders,
split manifests, rejected-video records, epoch logs, and evaluation reports.
It never copies checkpoints into the running application. GPU training requires
a CUDA-enabled PyTorch installation; use `--device cuda` to require GPU execution
instead of allowing automatic CPU fallback. Generated pose traces are ignored
by Git; checkpoints, epoch metrics, split manifests, and reports are retained.

Train one checkpoint per exercise: `arm_circumduction`,
`cross_body_shoulder_stretch`, `external_rotation`, and `internal_rotation`.
Combine LEFT/RIGHT recordings within circumduction and cross-body stretch.
Preserve side labels and participant/session identifiers for evaluation and
split groups before mirroring or augmentation. Confirm the rotation dataset's
view and arm labels before preprocessing it.

## Feature contract

Use `app.pose_features.EXERCISE_FEATURES[exercise_key]` for ordered training
columns and save that exact tuple as checkpoint `features`. All four currently
use 16 coordinates: Chest, Nose, both Shoulders, both Elbows, both Wrists, in
that order, with x then y for each point. Chest is the shoulder midpoint.
Exclude hips, knees, ankles, eyes, and ears from these initial profiles. Both
wrists retain the supporting arm in cross-body stretches. The nose preserves
head position relative to the shoulders. Do not change legacy checkpoint inputs.

Pass the feature tuple to `process_video_to_csv(..., expected_features=features)`
and `preprocess(..., expected_features=features)` when using the shared extractor.
Training notebooks with their own extractor must include YOLO indices
`0, 5, 6, 7, 8, 9, 10`. Re-extract old traces missing wrists; never pad absent
wrist columns with zeros to make an old trace fit. Use identical normalization
and side canonicalization during training and inference. Reflection must swap
left/right joint labels as well as reflect x coordinates, including wrists.

## Live recording integration

`client/lib/pose/exercise-key-points.ts` contains matching required-point
profiles for these exercises, including both wrists for either selected arm.
The live pose worker already exposes wrist landmarks. Add the four model
definitions only after compatible checkpoints are trained and evaluated;
the evaluation endpoint now requests each model's exact extraction features.

When enabling the new exercises in the recorder's model guidance config,
retain their exercise names so framing resolves the correct required points.
Keep visibility checks active during recording as well as preview. The current
live hook implements movement coaching only for flexion/abduction and otherwise
falls through to flexion coaching: add a framing/visibility-only branch for
these four exercises before enabling them. Do not reuse flexion repetition or
form rules for rotation, circumduction, or stretches. Side selection must reach
inference for the two combined-side models and must not remove the opposite
arm from visibility requirements. Anatomical arm labels must remain independent
of the mirrored webcam preview.

Validate held-out results per arm and camera view. Existing 2D pose features
do not by themselves guarantee reliable rotation scoring for every camera view;
check wrist/elbow occlusion and near-profile shoulder normalization explicitly.
