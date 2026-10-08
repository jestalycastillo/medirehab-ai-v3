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
The live pose worker already exposes wrist landmarks. The four trained
checkpoints are deployed in `app/models` and registered with their feature and
arm-transformation metadata. The evaluation endpoint requests each model's exact
extraction features. Its multipart `selected_side` field is required for
circumduction and cross-body stretch, and omitted for the rotation models.

The recorder's model config enables all four exercises. Visibility checks stay
active in preview and recording. New exercises have their own movement
instructions and upper-body live-coaching rules. The rules require the same
nose, chest, shoulder, elbow, and wrist points used during model extraction,
then give pose-position prompts without estimating repetitions or a clinical
range-of-motion score. Flexion/abduction repetition and form rules remain
specific to those existing exercises. The two combined
models support per-arm recordings, shared visits, and per-arm score summaries.
Both arms remain required in the visibility checks. Anatomical arm labels are
independent of the mirrored webcam preview.

The new scores use the validation-calibrated reconstruction similarity from the
training reports, rather than the legacy arm-elevation clinical scoring formula.

## Database catalog activation

From `server`, run `npm run db:add:physiotherapy -- --dry-run` for a read-only
preview. After explicit database-write approval, `npm run db:add:physiotherapy
-- --apply` adds only the four missing exercise records. It preserves all
existing exercises, assignments, results, and session history; conflicts fail
without updating existing entries. No schema migration or automatic startup
seeding is needed.

Validate held-out results per arm and camera view. Existing 2D pose features
do not by themselves guarantee reliable rotation scoring for every camera view;
check wrist/elbow occlusion and near-profile shoulder normalization explicitly.
