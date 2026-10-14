import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "training"))
from train_physiotherapy_models import dataset_records, split_groups


class TrainingSplitTests(unittest.TestCase):
    def test_related_recordings_never_cross_splits(self):
        records = [{"group": f"P{person}", "view": view} for person in range(7) for view in ("AF", "AL", "AR")]
        split = split_groups(records, 42)
        self.assertEqual(split, split_groups(records, 42))
        self.assertEqual({row["split"] for row in split}, {"train", "validation", "test"})
        for person in range(7):
            self.assertEqual(len({row["split"] for row in split if row["group"] == f"P{person}"}), 1)

    def test_rotation_view_codes_are_not_arm_labels(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / "external-rotation"
            folder.mkdir()
            for view in ("AF", "AL", "AR"):
                (folder / f"E03_P01_{view}_VFL_GM.mp4").touch()
            rows = dataset_records(root, "external_rotation")
            self.assertEqual({row["group"] for row in rows}, {"P01"})
            self.assertEqual({row["side"] for row in rows}, {"unverified"})
            self.assertEqual({row["view"] for row in rows}, {"AF", "AL", "AR"})

    def test_matching_left_right_recordings_share_a_group(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            for side in ("LEFT", "RIGHT"):
                folder = root / "Arm_Circumduction" / side
                folder.mkdir(parents=True)
                (folder / f"Arm_Circumduction_{side}_001.mp4").touch()
            rows = dataset_records(root, "arm_circumduction")
            self.assertEqual(len({row["group"] for row in rows}), 1)
            self.assertEqual({row["side"] for row in rows}, {"left", "right"})


if __name__ == "__main__":
    unittest.main()
