from pathlib import Path

import torch
import numpy as np
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader


CHECKPOINT_PATH = (
    Path(__file__).resolve().parents[2]
    / "training"
    / "checkpoints"
    / "side_arms_raise_v1.pth"
)


def train_model(model, train_data, val_data):
    best_val_loss = float("inf")

    if CHECKPOINT_PATH.exists():
        model_checkpoint = torch.load(CHECKPOINT_PATH, map_location="cpu")
        model.load_state_dict(model_checkpoint["model"])
        best_val_loss = model_checkpoint.get("best_val_loss", float("inf"))

    train_data = torch.tensor(train_data, dtype=torch.float32)
    val_data = torch.tensor(val_data, dtype=torch.float32)

    train_loader = DataLoader(
        TensorDataset(train_data),
        batch_size=8,
        shuffle=True
    )

    val_loader = DataLoader(
        TensorDataset(val_data),
        batch_size=8,
        shuffle=False
    )

    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    criterion = nn.MSELoss()

    epochs = 100

    for epoch in range(epochs):
        
        model.train()

        train_loss = 0.0

        for (batch,) in train_loader:

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

                output = model(batch)

                loss = criterion(output, batch)

                val_loss += loss.item()

        val_loss /= len(val_loader)

        if val_loss < best_val_loss:

            best_val_loss = val_loss

            # Calculate calibration parameters on combined train + val data
            cal_errors = []
            with torch.no_grad():
                for sample in train_data:
                    sample = sample.unsqueeze(0)
                    output = model(sample)
                    cal_errors.append(torch.mean((output - sample) ** 2).item())
                for sample in val_data:
                    sample = sample.unsqueeze(0)
                    output = model(sample)
                    cal_errors.append(torch.mean((output - sample) ** 2).item())
            
            mean_val_loss = float(np.mean(cal_errors))
            std_val_loss = float(np.std(cal_errors))
            if std_val_loss < 1e-4:
                std_val_loss = 1e-4
            
            k = 3.0
            beta = float(np.log(2.0) / (k * std_val_loss))

            CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
            torch.save({
                "model": model.state_dict(),
                "best_val_loss": best_val_loss,
                "mean_val_loss": mean_val_loss,
                "std_val_loss": std_val_loss,
                "beta": beta
            }, CHECKPOINT_PATH)
            
            print(f"Saved new best model with val loss: {best_val_loss:.6f} at epoch {epoch+1:03d}")
            print(f"Calibrated stats -> Mean: {mean_val_loss:.6f}, Std: {std_val_loss:.6f}, Beta: {beta:.4f}")

        print(
            f"Epoch {epoch+1:03d} | "
            f"Train Loss: {train_loss:.6f} | "
            f"Val Loss: {val_loss:.6f}"
        )

    return model
