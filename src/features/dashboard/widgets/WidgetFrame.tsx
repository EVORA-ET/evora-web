import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { GripVertical, X } from "lucide-react";

import { AttentionCountBadge } from "./insightWidgets";
import { SIZE_PRESETS, type WidgetDefinition, type WidgetSize } from "./types";
import "./widgets.css";

class WidgetBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Widget failed to render", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="w-empty">
          <p className="w-empty__title">This widget couldn't load</p>
          <p className="w-empty__text">Try refreshing the page.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

interface WidgetFrameProps {
  definition: WidgetDefinition;
  editing: boolean;
  highlighted?: boolean;
  currentSize?: WidgetSize;
  onRemove?: () => void;
  onResize?: (size: WidgetSize) => void;
}

function WidgetFrame({
  definition,
  editing,
  highlighted = false,
  currentSize,
  onRemove,
  onResize,
}: WidgetFrameProps) {
  const { Component: Body, icon: Icon, title, tone = "default" } = definition;
  if (!Body) return null;

  return (
    <article
      className={[
        "dash-widget",
        `dash-widget--${tone}`,
        editing ? "dash-widget--editing" : "",
        highlighted ? "dash-widget--highlight" : "",
      ].join(" ")}
    >
      <header className="dash-widget__header">
        <span className="dash-widget__icon" aria-hidden="true">
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <h3 className="dash-widget__title">{title}</h3>
        {definition.id === "todays-attention" && !editing && <AttentionCountBadge />}
      </header>

      <div className="dash-widget__body">
        <WidgetBoundary>
          <Body />
        </WidgetBoundary>
      </div>

      {editing && (
        <div className="dash-widget__controls">
          <span className="dash-widget__grip" title="Drag to move">
            <GripVertical size={16} strokeWidth={2} />
          </span>

          <div className="dash-widget__sizes" role="group" aria-label={`Size of ${title}`}>
            {SIZE_PRESETS.map((preset) => {
              const active =
                currentSize &&
                currentSize.w === Math.max(definition.minSize.w, preset.size.w) &&
                currentSize.h === Math.max(definition.minSize.h, preset.size.h);

              return (
                <button
                  key={preset.key}
                  type="button"
                  className={`dash-widget__size ${active ? "dash-widget__size--active" : ""}`}
                  onClick={() => onResize?.(preset.size)}
                  title={`${preset.label} size`}
                >
                  {preset.label.charAt(0)}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="dash-widget__remove"
            onClick={onRemove}
            aria-label={`Remove ${title}`}
            title="Remove"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      )}
    </article>
  );
}

export default WidgetFrame;
