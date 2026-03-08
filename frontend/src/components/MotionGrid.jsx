import React from "react";

export default function MotionGrid({
  children,
  className = "",
  itemClassName = "",
  stagger = 70,
}) {
  const items = React.Children.toArray(children);

  return (
    <div className={className}>
      {items.map((child, index) => {
        const delay = `${index * stagger}ms`;

        if (!React.isValidElement(child)) {
          return (
            <div
              key={`motion-${index}`}
              className={`motion-card motion-hover ${itemClassName}`}
              style={{ animationDelay: delay }}
            >
              {child}
            </div>
          );
        }

        const existingClass = child.props.className || "";
        const existingStyle = child.props.style || {};

        return React.cloneElement(child, {
          key: child.key ?? `motion-${index}`,
          className: `${existingClass} motion-card motion-hover ${itemClassName}`.trim(),
          style: { ...existingStyle, animationDelay: delay },
        });
      })}
    </div>
  );
}
