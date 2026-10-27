import os
import glob
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
    "legend.fontsize": 10.5,
    "xtick.labelsize": 10.5,
    "ytick.labelsize": 10.5,
})

# -------------------------------------------------------------------------
# 2. Locate Real Run Logs from ai-service
# -------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RUNS_DIR = os.path.join(BASE_DIR, "runs", "20261008_183313_49eb033f")

exercise_map = {
    "arm_circumduction": "Arm Circumduction",
    "cross_body_shoulder_stretch": "Cross-Body Shoulder Stretch",
    "external_rotation": "External Shoulder Rotation",
    "internal_rotation": "Internal Shoulder Rotation"
}

fig, axes = plt.subplots(2, 2, figsize=(14, 10), dpi=300)
axes = axes.flatten()

palette = {"Training Loss": "#2563EB", "Validation Loss": "#059669"}

# -------------------------------------------------------------------------
# 3. Plot Each Real 100-Epoch Run
# -------------------------------------------------------------------------
for idx, (folder, title) in enumerate(exercise_map.items()):
    csv_path = os.path.join(RUNS_DIR, folder, "epochs.csv")
    df = pd.read_csv(csv_path)

    # Format for Seaborn lineplot
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

    # Mark Best Checkpoint (Lowest Validation Loss)
    best_idx = df["validation_loss"].idxmin()
    best_epoch = df.loc[best_idx, "epoch"]
    best_val = df.loc[best_idx, "validation_loss"]

    ax.scatter([best_epoch], [best_val], color="#DC2626", s=60, zorder=5, label=f"Best Model (Epoch {int(best_epoch)})")
    ax.axvline(best_epoch, color="#DC2626", linestyle=":", alpha=0.65, linewidth=1.3)

    ax.set_title(f"{title}\n(Optimal Val Loss: {best_val:.4f} at Epoch {int(best_epoch)})", fontweight="bold", fontsize=12)
    ax.set_xlabel("Epoch Number")
    ax.set_ylabel("Reconstruction Loss (MSE)")
    ax.legend(loc="upper right", frameon=True, facecolor="white", framealpha=0.92)

plt.suptitle(
    "Figure 3.12: Empirical Training and Validation Loss Curves Across 100 Epochs (Real Run Data)",
    fontsize=14,
    fontweight="bold",
    y=0.99
)
plt.tight_layout()

output_path = os.path.join(BASE_DIR, "real_training_validation_loss_curves.png")
plt.savefig(output_path, dpi=300, bbox_inches="tight")
print(f"✓ Figure saved successfully to: {output_path}")
