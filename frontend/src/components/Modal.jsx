import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  contentClassName = "",
}) {
  const resolvedDescription =
    typeof description === "string" && description.trim()
      ? description.trim()
      : title
        ? `${title} dialog`
        : "Dialog content";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-lg ${contentClassName}`.trim()}>
        {title ? (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">
              {resolvedDescription}
            </DialogDescription>
          </DialogHeader>
        ) : (
          <DialogDescription className="sr-only">
            {resolvedDescription}
          </DialogDescription>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
