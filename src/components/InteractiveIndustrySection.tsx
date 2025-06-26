"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Button3 } from '@/ui';
import { FeatherArrowRight } from '@subframe/core';

// Industry interface for the component
export interface InteractiveIndustry {
  id: string;
  name: string;
  icon: string;
  image: string;
  description: string;
  url: string;
}

interface InteractiveIndustrySectionProps {
  industries: InteractiveIndustry[];
}

export default function InteractiveIndustrySection({ industries }: InteractiveIndustrySectionProps) {
  const [activeIndustry, setActiveIndustry] = useState<InteractiveIndustry | null>(null);
  const [shouldLoadImages, setShouldLoadImages] = useState(false);

  // Set initial active industry when industries are loaded
  useEffect(() => {
    if (industries.length > 0 && !activeIndustry) {
      setActiveIndustry(industries[0]);
    }
  }, [industries, activeIndustry]);

  // Simple 10-second delay for image loading
  useEffect(() => {
    const timer = setTimeout(() => setShouldLoadImages(true), 7000);
    return () => clearTimeout(timer);
  }, []);

  // Show loading state if no industries provided
  if (!industries || industries.length === 0) {
    return (
      <div className="w-full max-w-[1080px] mx-auto md:px-2 mobile:px-0 overflow-visible">
        <div className="flex flex-col md:flex-row bg-neutral-100 rounded-md shadow-md lg:p-4 md:p-0 mobile:p-2 gap-0 lg:min-h-[480px] shadow-[0px_0px_55px_-2px_rgba(0,_0,_0,_0.1)]">
          <div className="w-full md:w-[75%] relative overflow-hidden rounded-md mobile:hidden bg-neutral-200 animate-pulse">
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-sm text-gray-500">Loading industries...</div>
            </div>
          </div>
          <div className="w-full md:w-[25%] flex flex-col gap-2 py-4">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="w-full py-3 pl-6 pr-2 bg-neutral-200 animate-pulse rounded-sm">
                <div className="h-6 bg-neutral-300 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1080px] mx-auto md:px-2 mobile:px-0 overflow-visible ">
      

      <div className="flex flex-col md:flex-row bg-neutral-100 rounded-md shadow-md lg:p-4 md:p-0 mobile:p-2 gap-0 lg:min-h-[480px] shadow-[0px_0px_55px_-2px_rgba(0,_0,_0,_0.1)]">

        {/* Right Column: Dynamic Content */}
        <div className="w-full md:w-[75%] relative overflow-hidden rounded-md mobile:hidden">
          <AnimatePresence mode="wait">
            {activeIndustry && (
              <motion.div
                key={activeIndustry.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                className="w-full h-full"
              >
                {shouldLoadImages && activeIndustry.image && (
                  <Image
                    src={activeIndustry.image}
                    alt={activeIndustry.name}
                    fill
                    className="object-cover"
                    loading="lazy"
                    priority={false}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent p-8 flex flex-col items-start justify-end">
                  <h3 className="lg:text-heading-3 md:text-heading-3-md text-white font-bold font-heading-3">{activeIndustry.name}</h3>
                  <p className="text-body-lg text-neutral-200 mt-2 mb-4 max-w-md font-body">{activeIndustry.description}</p>
                  <Button3 variant="destructive-primary" size="medium" iconRight={<FeatherArrowRight />}>
                    Learn More
                  </Button3>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Left Column: Industry List */}
        <div className="w-full md:w-[25%] flex flex-col gap-2 py-4">
          {industries.map((industry) => (
            <button
              key={industry.id}
              onClick={() => setActiveIndustry(industry)}
              className={`relative text-consort-blue text-left w-full py-3 pl-6 pr-2 rounded-sm transition-colors duration-200 mobile:pointer-events-none ${
                activeIndustry?.id === industry.id
                  ? 'bg-neutral-200 !text-consort-red mobile:bg-transparent'
                  : 'hover:bg-neutral-200 mobile:hover:bg-transparent'
              }`}
            >
              <div className="flex flex-row items-center gap-5">
                {shouldLoadImages && industry.icon && (
                  <Image 
                    src={industry.icon} 
                    alt={`${industry.name} icon`} 
                    width={40} 
                    height={40}
                    className="w-8 h-8 mobile:w-8 mobile:h-8 lg:block md:hidden"
                    loading="lazy"
                    priority={false}
                  />
                )}
                <h2 className="mobile:text-body-xl-sm md:text-body-xl-md lg:text-body-xl-md font-body-xl text-inherit">{industry.name}</h2>
              </div>
              {activeIndustry?.id === industry.id && (
                <motion.div
                  className="absolute left-0 top-0 bottom-0 w-1 bg-consort-red mobile:hidden"
                  layoutId="active-industry-indicator"
                />
              )}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
} 