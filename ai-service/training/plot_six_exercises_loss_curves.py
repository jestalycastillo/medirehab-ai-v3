import os
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# -------------------------------------------------------------------------
# 1. Seaborn Academic Theme Configuration
# -------------------------------------------------------------------------
sns.set_theme(style="whitegrid", font="sans-serif")
plt.rcParams.update({
    "font.size": 11,
    "axes.labelsize": 12,
    "axes.titlesize": 13,
    "legend.fontsize": 10,
    "xtick.labelsize": 10,
    "ytick.labelsize": 10,
})

# -------------------------------------------------------------------------
# 2. Six Core Exercises and Real Epoch History CSV Paths
# -------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RUNS_DIR = os.path.join(BASE_DIR, "runs", "20261008_183313_49eb033f")
SAVED_DIR = os.path.join(BASE_DIR, "runs", "saved_flexion_abduction")

exercise_configs = [
    {
        "title": "Shoulder Flexion",
        "csv": os.path.join(SAVED_DIR, "flexion_epochs.csv")
    },
    {
        "title": "Shoulder Abduction",
        "csv": os.path.join(SAVED_DIR, "abduction_epochs.csv")
    },
    {
        "title": "Arm Circumduction",
        "csv": os.path.join(RUNS_DIR, "arm_circumduction", "epochs.csv")
    },
    {
        "title": "Cross-Body Shoulder Stretch",
        "csv": os.path.join(RUNS_DIR, "cross_body_shoulder_stretch", "epochs.csv")
    },
    {
        "title": "External Shoulder Rotation",
        "csv": os.path.join(RUNS_DIR, "external_rotation", "epochs.csv")
    },
    {
        "title": "Internal Shoulder Rotation",
        "csv": os.path.join(RUNS_DIR, "internal_rotation", "epochs.csv")
    }
]

# -------------------------------------------------------------------------
# 3. Create 3x2 Subplots Grid
# -------------------------------------------------------------------------
fig, axes = plt.subplots(3, 2, figsize=(15, 14), dpi=300)
axes = axes.flatten()

palette = {"Training Loss": "#2563EB", "Validation Loss": "#059669"}

for idx, item in enumerate(exercise_configs):
    df = pd.read_csv(item["csv"])

    df_train = pd.DataFrame({"Epoch": df["epoch"], "Loss": df["train_loss"], "Split": "Training Loss"})
    df_val = pd.DataFrame({"Epoch": df["epoch"], "Loss": df["validation_loss"], "Split": "Validation Loss"})
    df_plot = pd.concat([df_train, df_val], ignore_index=True)

    ax = axes[idx]
    sns.lineplot(
        data=df_plot,
        x="Epoch",
        y="Loss",
        hue="Split",
        style="Split",
        palette=palette,
        linewidth=2.0,
        ax=ax
    )

    # Highlight optimal checkpoint
    best_idx = df["validation_loss"].idxmin()
    best_epoch = int(df.loc[best_idx, "epoch"])
    best_val = float(df.loc[best_idx, "validation_loss"])

    ax.scatter([best_epoch], [best_val], color="#DC2626", s=60, zorder=5, label=f"Best Checkpoint (Epoch {best_epoch})")
    ax.axvline(best_epoch, color="#DC2626", linestyle=":", alpha=0.65, linewidth=1.2)

    ax.set_title(f"{item['title']}\n(Optimal Val Loss: {best_val:.4f} at Epoch {best_epoch})", fontweight="bold", fontsize=12)
    ax.set_xlabel("Epoch Number")
    ax.set_ylabel("Reconstruction Loss (MSE)")
    ax.legend(loc="upper right", frameon=True, facecolor="white", framealpha=0.92)

plt.suptitle(
    "Figure 3.12: Empirical Training and Validation Loss Curves Across 100 Epochs",
    fontsize=15,
    fontweight="bold",
    y=0.995
)
plt.tight_layout()

output_path = os.path.join(BASE_DIR, "six_exercises_loss_curves.png")
plt.savefig(output_path, dpi=300, bbox_inches="tight")
print(f"✓ Figure saved successfully to: {output_path}")
