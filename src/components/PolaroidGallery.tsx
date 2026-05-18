"use client";

import Polaroid, { type polaroidVariants } from "./Polaroid";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface TImage {
  src: string;
  variant: keyof typeof polaroidVariants;
}

interface PolaroidGalleryProps {
  images: TImage[];
  event: string;
  title?: string;
}

const PolaroidGallery = ({ images, event }: PolaroidGalleryProps) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const displayImages = images.slice(0, 6);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const cardWidth = 128;
  const spacing = 32;
  const totalWidth = (displayImages.length - 1) * spacing + cardWidth;
  const offsetLeft = -(totalWidth / 2 - cardWidth / 2);
  const photoWallUrl = `/photo-wall?id=${event}`;

  return (
    <a href={photoWallUrl} className="block">
      <motion.div
        ref={ref}
        className="relative w-full cursor-pointer flex items-center justify-center overflow-visible"
        style={{
          height: "210px",
          minHeight: "210px"
        }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <div
          className="relative"
          style={{
            width: `${totalWidth}px`,
            height: "190px",
            marginLeft: `${offsetLeft + 55}px`
          }}
        >
          {displayImages.map((image, index) => (
            <Polaroid
              isVisible={isVisible}
              index={index}
              total={displayImages.length}
              key={image.src}
              variant={image.variant}
              src={image.src}
            />
          ))}
        </div>
      </motion.div>
    </a>
  );
};

export default PolaroidGallery;
