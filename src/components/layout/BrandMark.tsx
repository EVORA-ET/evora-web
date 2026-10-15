import "./BrandMark.css";

interface BrandMarkProps {
  size?: number;
}

/** The "E" tile used next to the EVORA wordmark. */
function BrandMark({ size = 40 }: BrandMarkProps) {
  return (
    <span
      className="brand-mark"
      style={{ width: size, height: size, fontSize: size * 0.52 }}
      aria-hidden="true"
    >
      E
    </span>
  );
}

export default BrandMark;
