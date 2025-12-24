import { motion } from "framer-motion";

export default function TypingText({
  text,
  onComplete,
  size = "xl",
  color = "blue",
}) {
  const letters = text.split("");

  const sizeClassMap = {
    xs: "text-sm md:text-base",
    sm: "text-base md:text-lg",
    md: "text-lg md:text-xl",
    lg: "text-xl md:text-2xl",
    xl: "text-3xl md:text-4xl lg:text-5xl",
    hero: "text-4xl md:text-5xl lg:text-6xl",
  };

  const colorClassMap = {
    pink: "from-pink-400 via-rose-400 to-fuchsia-500",
    blue: "from-sky-400 via-blue-500 to-indigo-500",
    purple: "from-purple-400 via-violet-500 to-indigo-600",
    mint: "from-emerald-400 via-teal-400 to-cyan-400",
    mono: "from-neutral-200 via-neutral-300 to-neutral-400",
  };

  const sizeClass = sizeClassMap[size] || sizeClassMap.lg;
  const gradientClass =
    colorClassMap[color] || colorClassMap.blue;

  return (
    <motion.div
  key={text}
  className="relative z-20 font-semibold leading-relaxed select-none"
  initial="hidden"
  animate="visible"
  variants={{
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.1, // ⏳ 글자 간 등장 속도 (기존 0.04)
      },
    },
  }}
>
  {letters.map((char, i) => {
    const isLast = i === letters.length - 1;

    return (
      <motion.span
        key={i}
        className={`
          inline-block
          ${sizeClass}
          bg-gradient-to-r ${gradientClass}
          bg-clip-text text-transparent
          drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]
        `}
        onAnimationComplete={isLast ? onComplete : undefined}
        variants={{
          hidden: {
            opacity: 0,
            y: 10,
            filter: "blur(6px)",
          },
          visible: {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            transition: {
              duration: 0.4, // ⏳ 글자 자체 애니메이션 속도
              ease: "easeOut",
            },
          },
        }}
      >
        {char === " " ? "\u00A0" : char}
      </motion.span>
    );
  })}
</motion.div>

  );
}
