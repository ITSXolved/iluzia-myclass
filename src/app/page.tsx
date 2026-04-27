'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import s from './page.module.css';

const FRAME_COUNT = 40;

// Update to ensure minimum 3 padding: e.g. 001, 040
function currentFrame(index: number) {
  return `/3d-image/ezgif-frame-${String(index).padStart(3, '0')}.jpg`;
}

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  
  // Framer Motion scroll tracking
  const { scrollYProgress } = useScroll();
  
  // Map scroll progress (0 to 1) to integer frame (1 to 40)
  const frameIndex = useTransform(scrollYProgress, [0, 1], [1, FRAME_COUNT], {
    clamp: true,
  });

  // Preload images safely in client
  useEffect(() => {
    const loadedImages: HTMLImageElement[] = [];
    let loadedCount = 0;
    
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new window.Image();
      img.src = currentFrame(i);
      img.onload = () => {
        loadedCount++;
        // If we want to only start rendering once all are loaded, we can track this
        // But for now, we just push the references.
      };
      loadedImages.push(img);
    }
    setImages(loadedImages);
  }, []);

  // Draw frame when frameIndex changes
  useEffect(() => {
    if (images.length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set up internal canvas res to perfectly fit a standard 16:9 monitor
    // The images from ezgif might have a specific aspect ratio. Let's assume standard HD.
    canvas.width = 1920;
    canvas.height = 1080;

    const render = (val: number) => {
      const index = Math.round(val) - 1; // 0-indexed array
      const img = images[index];
      
      if (img && img.complete) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = img.width / img.height;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;

        // Simulate object-fit: cover
        if (canvasRatio > imgRatio) {
          drawHeight = canvas.width / imgRatio;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          drawWidth = canvas.height * imgRatio;
          offsetX = (canvas.width - drawWidth) / 2;
        }

        // Slight fade in for the image to blend with background
        ctx.globalAlpha = 1.0; 
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      }
    };

    // Initial render
    render(frameIndex.get());
    
    // Subscribe to scroll updates
    const unsubscribe = frameIndex.on("change", (latestVal) => {
      render(latestVal);
    });
    
    return () => unsubscribe();
  }, [images, frameIndex]);

  return (
    <div className={s.landing}>
      {/* ── Fixed Canvas Player ── */}
      <div className={s.canvasContainer}>
        <canvas ref={canvasRef} />
        <div className={s.canvasVignette} />
      </div>

      {/* ── Navbar ── */}
      <nav className={s.nav}>
        <Link href="/" className={s.logo}>
          <Image src="/iluzia-logo.png" alt="iLuZia Lab" width={40} height={40} style={{ objectFit: 'contain', width: 'auto', height: '40px' }} />
          iLuZia | 3DX
        </Link>
        <div className={s.navLinks}>
          <a href="#vision">The Vision</a>
          <a href="#tech">The Tech</a>
          <a href="#robotics">Robotics</a>
          <a href="#curriculum">Curriculum</a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div className={s.navLinks}>
            <Link href="/login">Log In</Link>
          </div>
          <Link href="/signup" className={s.ctaPill}>Join the Future</Link>
        </div>
      </nav>

      {/* ── Scrollable Content Overlays ── */}
      <main className={s.scrollContent}>
        {/* Section 1: The Catalyst */}
        <section className={s.section} id="vision" style={{ height: '140vh', alignItems: 'flex-start', paddingTop: '30vh' }}>
          <motion.div 
            className={s.heroContent}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className={s.heroTitle}>Beyond the <span style={{ color: 'var(--accent-500)' }}>Screen.</span></h1>
            <h2 className={s.heroSubtitle}>Learn in 4D.</h2>
            <p className={s.heroSubtext}>
              Bridging the gap between conceptual engineering and physical <br/> reality through spatial computing.
            </p>
          </motion.div>
        </section>

        {/* Section 2: The Anatomy of Innovation */}
        <section className={s.section} id="tech" style={{ padding: '0 40px', height: '180vh', display: 'block', paddingTop: '10vh' }}>
          <div className={s.sidePinLayout}>
            <div>
              <motion.div 
                className={s.anatomyBlock}
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ margin: "-200px" }}
                transition={{ duration: 0.6 }}
              >
                <h3>Precision Kinematics.</h3>
                <p>0.01mm accuracy for industrial-grade learning.</p>
              </motion.div>

              <motion.div 
                className={s.anatomyBlock}
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ margin: "-200px" }}
                transition={{ duration: 0.6 }}
                style={{ marginTop: '10vh' }}
              >
                <h3>Neural Link.</h3>
                <p>Powered by TeachX AI for real-time gesture control.</p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Section 3: Spatial Mastery */}
        <section id="robotics" className={s.editorialSection}>
          <motion.div 
            className={s.editorialContent}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className={s.editorialTitle}>A Classroom <br/>Without Walls.</h2>
            <p className={s.editorialDesc}>
              3DX isn&apos;t just a course; it&apos;s a sandbox. Design in Blender, simulate in AR, and deploy to the physical world in one seamless loop.
            </p>
          </motion.div>
        </section>

        {/* Section 4: The Reassembly / CTA */}
        <section id="curriculum" className={s.section} style={{ padding: 0, minHeight: '60vh', display: 'block' }}>
          <div className={`${s.finalCtaSection} ${s.section}`}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h2 className={s.finalCtaTitle}>
                The Era of the <br/><span style={{ color: 'var(--primary-400)' }}>Creative Engineer</span> is here.
              </h2>
              <div className={s.ctaRow}>
                <Link href="/signup" className={s.ctaPill} style={{ padding: '16px 36px', fontSize: '1.1rem' }}>
                  Explore the 3DX Curriculum
                </Link>
                <Link href="/login" className={s.ctaOutlinePill} style={{ padding: '16px 36px', fontSize: '1.1rem' }}>
                  Pre-Enroll in TeachX AI
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}
