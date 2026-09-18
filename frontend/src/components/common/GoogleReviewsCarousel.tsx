import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, ExternalLink, Star } from 'lucide-react';
import { GOOGLE_REVIEWS_DATA } from '../../data/googleReviews';

interface GoogleReviewsCarouselProps {
  className?: string;
}

export const GoogleReviewsCarousel: React.FC<GoogleReviewsCarouselProps> = ({ className = '' }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollability = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.clientWidth > 768 ? 380 : 300;
      const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(checkScrollability, 350);
    }
  };

  return (
    <div className={`w-full flex flex-col space-y-6 ${className}`}>
      {/* Google Badge Summary Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:px-6 sm:py-4 border border-primary-100 shadow-2xs">
        <div className="flex items-center gap-3.5">
          {/* Official 4-Color Google G Logo */}
          <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-gray-100 flex items-center justify-center p-2 shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                Eccellente 5.0 su 5
              </span>
              <div className="flex items-center text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current text-amber-400" />
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Basato su recensioni verificate al 100% da clienti reali di Google
            </p>
          </div>
        </div>

        {/* Carousel Navigation Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-700 flex items-center justify-center hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-2xs cursor-pointer"
            aria-label="Recensione precedente"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-700 flex items-center justify-center hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-2xs cursor-pointer"
            aria-label="Recensione successiva"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      <div
        ref={scrollRef}
        onScroll={checkScrollability}
        className="flex items-stretch gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory py-1 px-0.5"
      >
        {GOOGLE_REVIEWS_DATA.map((rev) => (
          <div
            key={rev.id}
            className="w-[290px] sm:w-[350px] md:w-[380px] shrink-0 snap-start bg-white rounded-2xl p-5 sm:p-6 border border-primary-100/90 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              {/* Card Header: Author + Google Icon */}
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  {rev.avatar ? (
                    <img
                      src={rev.avatar}
                      alt={rev.author}
                      loading="lazy"
                      className="w-10 h-10 rounded-full object-cover border border-primary-200/60 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-900 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                      {rev.author.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-gray-900 truncate">
                      {rev.author}
                    </h4>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>{rev.date}</span>
                    </div>
                  </div>
                </div>

                {/* Google G small badge */}
                <div className="w-6 h-6 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 p-1">
                  <svg viewBox="0 0 24 24" className="w-4 h-4">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
              </div>

              {/* 5 Stars */}
              <div className="flex items-center gap-0.5 mb-2.5">
                {[...Array(rev.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current text-amber-400" />
                ))}
              </div>

              {/* Italian Review Text */}
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed italic line-clamp-6">
                "{rev.text}"
              </p>
            </div>

            {/* Bottom Tag */}
            <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600 font-medium">
              <span>Studio Milano</span>
              <span className="text-primary-700 font-semibold">Microblading & PMU</span>
            </div>
          </div>
        ))}
      </div>

      {/* Trust & Guarantee Callout Footer */}
      <div className="text-center pt-2">
        <a
          href="https://www.google.com/search?q=Chiara+Morocutti+Microblading+Milano+recensioni"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary-800 hover:text-primary-950 hover:underline transition-all"
        >
          <span>Leggi tutte le recensioni sul profilo Google ufficiale di Chiara Morocutti</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};

export default GoogleReviewsCarousel;
