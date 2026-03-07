import Image from "next/image";

export function BrandLogo({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/able-logo.png"
      alt="Able Fitness"
      width={size}
      height={size}
      className={`rounded-full ${className}`.trim()}
      priority
    />
  );
}
