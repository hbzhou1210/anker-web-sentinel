interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  passed?: boolean;
}

export function CircularProgress({
  percentage,
  size = 80,
  strokeWidth = 8,
  passed = true
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage === 100) return '#10b981'; // green-500
    if (percentage >= 80) return '#3b82f6';   // blue-500
    if (percentage >= 60) return '#f59e0b';   // amber-500
    return '#ef4444';                          // red-500
  };

  const color = getColor();

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* 背景圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* 进度圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* 中间的百分比文字 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>
          {Math.round(percentage)}
        </span>
        <span className="text-xs text-gray-500 -mt-1">%</span>
      </div>
    </div>
  );
}
