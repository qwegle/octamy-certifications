import { motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "span" | "h1" | "h2" | "h3" | "p" | "li";
  once?: boolean;
}

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once, margin: "-60px" });
  const reduceMotion = useReducedMotion();
  const Comp = motion[as] as any;
  return (
    <Comp
      ref={ref as any}
      initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      animate={reduceMotion || inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </Comp>
  );
}

export function Stagger({
  children,
  className,
  step = 0.08,
}: {
  children: ReactNode;
  className?: string;
  step?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={reduceMotion ? "show" : "hidden"}
      animate={reduceMotion || inView ? "show" : "hidden"}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: step, delayChildren: 0.05 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 20,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      variants={{
        hidden: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: reduceMotion ? { duration: 0 } : { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MagneticCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });
  const rotateX = useTransform(sy, [-40, 40], [6, -6]);
  const rotateY = useTransform(sx, [-40, 40], [-6, 6]);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set(e.clientX - cx);
    y.set(e.clientY - cy);
  }

  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onLeave}
      style={reduceMotion ? undefined : { rotateX, rotateY, transformPerspective: 800 }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 18 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function CountUp({
  to,
  suffix = "",
  duration = 1.4,
}: {
  to: number;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();
  const mv = useMotionValue(0);
  const sp = useSpring(mv, { stiffness: 60, damping: 18, duration });

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion && ref.current) ref.current.textContent = `${Math.round(to).toLocaleString()}${suffix}`;
    else mv.set(to);
  }, [inView, mv, reduceMotion, suffix, to]);

  useEffect(() => {
    return sp.on("change", (v: number) => {
      if (ref.current) ref.current.textContent = `${Math.round(v).toLocaleString()}${suffix}`;
    });
  }, [sp, suffix]);

  return <span ref={ref}>0{suffix}</span>;
}
