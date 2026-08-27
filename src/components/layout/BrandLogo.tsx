import { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  style?: CSSProperties;
  alt?: string;
  loading?: "eager" | "lazy";
  /** Always use the dark-mode logo (for permanently dark surfaces like the footer). */
  forceDark?: boolean;
}

const LIGHT_SRC = "/aqua-clear-logo.png";
const DARK_SRC = "/aqua-clear-logo-dark.png";

/**
 * Renders the Aqua Clear Pools logo, automatically swapping to the
 * high-contrast dark-mode variant on dark backgrounds.
 */
export const BrandLogo = ({
  className,
  style,
  alt = "Aqua Clear Pools",
  loading,
  forceDark = false,
}: BrandLogoProps) => {
  if (forceDark) {
    return <img src={DARK_SRC} alt={alt} className={className} style={style} loading={loading} />;
  }

  return (
    <>
      <img
        src={LIGHT_SRC}
        alt={alt}
        className={cn(className, "dark:hidden")}
        style={style}
        loading={loading}
      />
      <img
        src={DARK_SRC}
        alt={alt}
        aria-hidden="true"
        className={cn(className, "hidden dark:block")}
        style={style}
        loading={loading}
      />
    </>
  );
};

export default BrandLogo;
