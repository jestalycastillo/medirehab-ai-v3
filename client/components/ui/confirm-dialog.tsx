import { usePortalModalFocus } from "@/components/ui/use-portal-modal-focus";

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const modalRef = usePortalModalFocus(isOpen, onCancel);
  if (!isOpen) return null;

  return (
    <div className="portal-modal-overlay" onClick={onCancel}>
      <div
        ref={modalRef} tabIndex={-1}
        className="portal-modal-panel portal-modal-confirm animate-slide-up"
        role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="portal-modal-header">
          <span className="role-dashboard-eyebrow">Please confirm</span>
          <h2 id="confirm-dialog-title">{title}</h2>
        </div>
        <div className="portal-modal-copy"><p id="confirm-dialog-message">{message}</p></div>
        <div className="portal-modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${isDestructive ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={isLoading}
            style={{ position: "relative" }}
          >
            {isLoading ? (
              <>
                <div className="spinner spinner-white" style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                {confirmLabel}...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
