import { useEffect, useRef } from 'react';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Start video playback
    video.play().catch((err) => {
      console.warn("Autoplay was prevented by the browser. Waiting for interaction.", err);
    });

    let frameId: number;

    const checkFade = () => {
      if (video.duration) {
        const currentTime = video.currentTime;
        const duration = video.duration;
        const fadeDuration = 0.5; // 0.5s fade transitions
        let opacity = 1;

        if (currentTime < fadeDuration) {
          // Fade in over 0.5s at the start
          opacity = currentTime / fadeDuration;
        } else if (currentTime > duration - fadeDuration) {
          // Fade out over 0.5s before the end
          const timeRemaining = duration - currentTime;
          opacity = Math.max(0, timeRemaining / fadeDuration);
        }

        video.style.opacity = opacity.toFixed(3);
      }
      frameId = requestAnimationFrame(checkFade);
    };

    frameId = requestAnimationFrame(checkFade);

    const handleEnded = () => {
      // Set opacity to 0 immediately
      video.style.opacity = '0';
      
      // Wait 100ms, reset currentTime, and play again
      setTimeout(() => {
        if (video) {
          video.currentTime = 0;
          video.play().catch((err) => console.error("Error looping video:", err));
        }
      }, 100);
    };

    video.addEventListener('ended', handleEnded);

    return () => {
      cancelAnimationFrame(frameId);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white text-[#6F6F6F] flex flex-col font-sans">
      
      {/* Navigation Bar (z-10) */}
      <header className="relative z-10 w-full">
        <div className="flex justify-between items-center px-8 py-6 max-w-7xl mx-auto">
          {/* Logo */}
          <a href="/" className="flex items-center gap-1 group">
            <span className="text-3xl font-normal tracking-tight font-display text-black select-none">
              Rearvy<sup className="text-sm font-semibold relative -top-3 left-[1px]">®</sup>
            </span>
          </a>

          {/* Menu Items */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-sm font-medium text-black transition-colors hover:text-black/70">
              Home
            </a>
            <a href="#" className="text-sm font-medium text-[#6F6F6F] transition-colors hover:text-black">
              Download
            </a>
            <a href="#" className="text-sm font-medium text-[#6F6F6F] transition-colors hover:text-black">
              Demo
            </a>
            <a href="#" className="text-sm font-medium text-[#6F6F6F] transition-colors hover:text-black">
              Signin
            </a>
          </nav>

          {/* CTA Button */}
          <div>
            <a
              href="#"
              className="inline-block rounded-full px-6 py-2.5 text-sm font-medium bg-black text-white transition-all duration-200 hover:scale-103 active:scale-97 hover:shadow-lg hover:shadow-black/5"
            >
              Signup
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section (z-10) */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-start text-center px-6" style={{ paddingTop: 'calc(8rem - 75px)', paddingBottom: '10rem' }}>
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          
          {/* Subtle Glassmorphic Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.04] bg-black/[0.02] px-4 py-1.5 text-xs font-semibold text-[#6F6F6F] backdrop-blur-md mb-8 animate-fade-rise opacity-0">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            AI Executive Operating System
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-normal font-display leading-[0.95] tracking-[-2.46px] text-black max-w-7xl animate-fade-rise opacity-0">
            Rearvy turns business context into action.<br className="hidden sm:inline" />
            In <span className="text-[#6F6F6F] italic">silence,</span> we find <span className="text-[#6F6F6F] italic">the eternal.</span>
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg max-w-2xl mt-8 leading-relaxed text-[#6F6F6F] animate-fade-rise-delay opacity-0">
            Built for business. Execute quick and clean.
          </p>

          {/* Hero CTA Button */}
          <div className="animate-fade-rise-delay-2 opacity-0">
            <a
              href="#"
              className="inline-block rounded-full px-14 py-5 text-base font-semibold bg-black text-white transition-all duration-200 hover:scale-103 active:scale-97 hover:shadow-xl hover:shadow-black/10 mt-12"
            >
              Signup
            </a>
          </div>

        </div>
      </main>

      {/* Background Video Layer (z-0) */}
      <div 
        className="absolute z-0 overflow-hidden" 
        style={{ top: '300px', inset: 'auto 0 0 0', height: 'calc(100% - 300px)' }}
      >
        {/* Looping Video */}
        <video
          ref={videoRef}
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4"
          className="w-full h-full object-cover transition-opacity duration-75 pointer-events-none"
          muted
          playsInline
          style={{ opacity: 0 }}
        />
        
        {/* Gradient Overlay positioned over the video */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white pointer-events-none" />
      </div>

    </div>
  );
}
