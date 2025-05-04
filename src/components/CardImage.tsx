// src/components/CardImage.tsx
'use client';

import Image, { ImageProps } from 'next/image';

/**
 * A wrapper around `next/image` that replaces the old
 *   layout="fill" + objectFit="cover|contain|..."
 * pattern with the v13 API.
 *
 * Any incoming `layout` prop is swallowed so it never reaches <Image>.
 *
 * Usage:
 *   <CardImage
 *     src="/cards/bike-facility.png"
 *     alt="Bike Facility"
 *     objectFit="contain"
 *     sizes="(max-width: 640px) 50vw, 256px"
 *   />
 */
export default function CardImage(
  props: Omit<ImageProps, 'fill' | 'sizes' | 'style'> & {
    /** old objectFit value (defaults to 'cover'), turned into Tailwind `object-*` */
    objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    /** responsive sizes hint (optional override) */
    sizes?: string;
  }
) {
  const {
    // pull out old props so they don’t get passed to next/image
    layout,      // ⟵ legacy, ignored
    objectFit = 'cover',
    sizes = '(max-width: 768px) 40vw, 288px',
    ...imgProps
  } = props;

  return (
    <div className="relative w-[72px] h-[96px] sm:w-40 sm:h-56 shrink-0">
      {/* container must be positioned & sized for fill to work */}
      <Image
        fill
        priority
        className={`object-${objectFit} rounded-md`}
        sizes={sizes}
        {...imgProps}
      />
    </div>
  );
}
