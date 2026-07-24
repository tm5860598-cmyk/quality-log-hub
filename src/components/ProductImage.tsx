import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { resolveImageUrl } from "@/lib/product-media";

export function ProductImage({
  src, alt, className, fallbackClassName,
}: { src: string | null | undefined; alt: string; className?: string; fallbackClassName?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let m = true; resolveImageUrl(src).then((u) => { if (m) setUrl(u); }); return () => { m = false; }; }, [src]);
  if (!url) {
    return (
      <div className={fallbackClassName ?? className}>
        <Package className="w-1/2 h-1/2 text-indigo-400" />
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} />;
}