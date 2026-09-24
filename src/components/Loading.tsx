import { LoaderCircle } from 'lucide-react';

interface LoadingProps {
  /** Texto exibido abaixo do spinner */
  message?: string;
  /** Tamanho do spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Ocupa a tela inteira com fundo */
  fullPage?: boolean;
  /** Variante de cor */
  variant?: 'primary' | 'white' | 'muted';
  /** Classes extras no container */
  className?: string;
}

const sizeMap = {
  sm: 18,
  md: 28,
  lg: 40,
} as const;

const colorMap = {
  primary: 'text-primary-600',
  white: 'text-white',
  muted: 'text-gray-400',
} as const;

export function Loading({
  message = 'Carregando...',
  size = 'md',
  fullPage = false,
  variant = 'primary',
  className = '',
}: LoadingProps) {
  const spinner = (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <LoaderCircle
        size={sizeMap[size]}
        className={`animate-spin ${colorMap[variant]}`}
        strokeWidth={2.5}
      />
      {message && (
        <p
          className={`text-sm font-medium ${
            variant === 'white' ? 'text-white/90' : 'text-gray-500'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-white/80 backdrop-blur-sm animate-fade-in">
        {spinner}
      </div>
    );
  }

  return spinner;
}

/** Versão compacta só com o ícone (útil dentro de botões) */
export function LoadingSpinner({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <LoaderCircle
      size={size}
      className={`animate-spin text-current ${className}`}
      strokeWidth={2.5}
    />
  );
}
