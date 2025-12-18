/**
 * LazyImage 组件 - 图片懒加载
 *
 * 使用 Intersection Observer API 实现图片懒加载
 * 仅在图片进入视口时才加载实际图片
 */

import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  /** 图片 URL */
  src: string;
  /** 图片 alt 文本 */
  alt: string;
  /** CSS 类名 */
  className?: string;
  /** 占位图 URL (可选) */
  placeholder?: string;
  /** 根边距 - 提前多少像素开始加载 (默认 50px) */
  rootMargin?: string;
  /** 加载完成回调 */
  onLoad?: () => void;
  /** 加载失败回调 */
  onError?: () => void;
}

/**
 * LazyImage - 懒加载图片组件
 *
 * 特性:
 * - 使用 Intersection Observer 自动检测图片是否进入视口
 * - 支持占位图
 * - 支持淡入动画
 * - 自动清理 observer
 *
 * 使用示例:
 * ```tsx
 * <LazyImage
 *   src="/path/to/image.jpg"
 *   alt="描述"
 *   placeholder="/path/to/placeholder.jpg"
 *   className="my-image"
 * />
 * ```
 */
export function LazyImage({
  src,
  alt,
  className,
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect width="400" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%23999"%3E加载中...%3C/text%3E%3C/svg%3E',
  rootMargin = '50px',
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    // 检查浏览器是否支持 Intersection Observer
    if (!('IntersectionObserver' in window)) {
      // 不支持则直接加载
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin, // 提前加载
        threshold: 0.01, // 只要有 1% 可见即触发
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <img
      ref={imgRef}
      src={isInView ? src : placeholder}
      alt={alt}
      className={className}
      onLoad={handleLoad}
      onError={handleError}
      style={{
        opacity: hasError ? 0.3 : isLoaded ? 1 : 0.5,
        transition: 'opacity 0.3s ease-in-out',
      }}
      loading="lazy" // 原生懒加载作为备用方案
    />
  );
}

/**
 * LazyBackgroundImage - 懒加载背景图片组件
 *
 * 用于需要背景图片的场景
 *
 * 使用示例:
 * ```tsx
 * <LazyBackgroundImage
 *   src="/path/to/bg.jpg"
 *   className="hero-section"
 * >
 *   <h1>标题</h1>
 * </LazyBackgroundImage>
 * ```
 */
interface LazyBackgroundImageProps {
  /** 背景图片 URL */
  src: string;
  /** 子元素 */
  children?: React.ReactNode;
  /** CSS 类名 */
  className?: string;
  /** 根边距 */
  rootMargin?: string;
}

export function LazyBackgroundImage({
  src,
  children,
  className,
  rootMargin = '50px',
}: LazyBackgroundImageProps) {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!divRef.current) return;

    if (!('IntersectionObserver' in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin,
        threshold: 0.01,
      }
    );

    observer.observe(divRef.current);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin]);

  useEffect(() => {
    if (!isInView) return;

    // 预加载背景图片
    const img = new Image();
    img.src = src;
    img.onload = () => setIsLoaded(true);
  }, [isInView, src]);

  return (
    <div
      ref={divRef}
      className={className}
      style={{
        backgroundImage: isInView ? `url(${src})` : undefined,
        opacity: isLoaded ? 1 : 0.5,
        transition: 'opacity 0.3s ease-in-out',
      }}
    >
      {children}
    </div>
  );
}
