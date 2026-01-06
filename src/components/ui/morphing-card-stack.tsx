import {
  AnimatePresence,
  LayoutGroup,
  motion,
  type PanInfo,
  useMotionValue,
  useTransform,
} from 'framer-motion'
import { Check, Grid3X3, Layers, LayoutList, X } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export type LayoutMode = 'stack' | 'grid' | 'list'
export type SwipeDirection = 'left' | 'right' | null

export interface CardData {
  id: string
  title: string
  description?: string
  icon?: ReactNode
  color?: string
  content?: ReactNode
}

export interface MorphingCardStackProps {
  cards?: CardData[]
  className?: string
  defaultLayout?: LayoutMode
  onCardClick?: (card: CardData) => void
  onSwipeLeft?: (card: CardData) => void
  onSwipeRight?: (card: CardData) => void
  onLayoutChange?: (layout: LayoutMode) => void
  removedCardIds?: Set<string>
  showLayoutToggle?: boolean
  renderCard?: (card: CardData, mode: LayoutMode) => ReactNode
  renderActions?: (
    card: CardData,
    handlers: { onAccept: () => void; onReject: () => void },
  ) => ReactNode
}

const layoutIcons = {
  grid: Grid3X3,
  list: LayoutList,
  stack: Layers,
}

const SWIPE_THRESHOLD = 80
const VELOCITY_THRESHOLD = 500

export function MorphingCardStack({
  cards = [],
  className,
  defaultLayout = 'stack',
  onCardClick,
  onSwipeLeft,
  onSwipeRight,
  onLayoutChange,
  removedCardIds = new Set(),
  showLayoutToggle = true,
  renderCard,
  renderActions,
}: MorphingCardStackProps) {
  const [layout, setLayout] = useState<LayoutMode>(defaultLayout)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [exitingCardId, setExitingCardId] = useState<string | null>(null)
  const [exitDirection, setExitDirection] = useState<SwipeDirection>(null)

  const x = useMotionValue(0)
  const swipeProgress = useTransform(x, [-200, 0, 200], [-1, 0, 1])

  const visibleCards = useMemo(
    () => cards.filter(card => !removedCardIds.has(card.id) && card.id !== exitingCardId),
    [cards, removedCardIds, exitingCardId],
  )

  if (!cards || cards.length === 0) {
    return null
  }

  const handleLayoutChange = (newLayout: LayoutMode) => {
    setLayout(newLayout)
    onLayoutChange?.(newLayout)
  }

  const handleSwipe = (card: CardData, direction: SwipeDirection) => {
    if (!direction) return

    setExitingCardId(card.id)
    setExitDirection(direction)

    setTimeout(() => {
      if (direction === 'left') {
        onSwipeLeft?.(card)
      } else {
        onSwipeRight?.(card)
      }
      setExitingCardId(null)
      setExitDirection(null)
    }, 200)
  }

  const handleDragEnd = (card: CardData, info: PanInfo) => {
    const { offset, velocity } = info

    const swipedLeft = offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD
    const swipedRight = offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD

    if (swipedLeft) {
      handleSwipe(card, 'left')
    } else if (swipedRight) {
      handleSwipe(card, 'right')
    }

    setIsDragging(false)
    x.set(0)
  }

  const handleAccept = (card: CardData) => {
    handleSwipe(card, 'right')
  }

  const handleReject = (card: CardData) => {
    handleSwipe(card, 'left')
  }

  const getStackOrder = () => {
    return visibleCards.map((card, i) => ({
      ...card,
      stackPosition: visibleCards.length - 1 - i,
    }))
  }

  const getLayoutStyles = (stackPosition: number) => {
    const maxVisible = Math.min(visibleCards.length, 5)
    const normalizedPosition = Math.min(stackPosition, maxVisible - 1)

    switch (layout) {
      case 'stack':
        return {
          boxShadow:
            normalizedPosition === 0
              ? '0 10px 40px -10px rgba(0,0,0,0.3)'
              : `0 ${4 + normalizedPosition * 2}px ${10 + normalizedPosition * 5}px -${5 + normalizedPosition}px rgba(0,0,0,0.15)`,
          left: 0,
          rotate:
            normalizedPosition === 0
              ? 0
              : (normalizedPosition % 2 === 0 ? 1 : -1) * (normalizedPosition * 3),
          scale: 1 - normalizedPosition * 0.04,
          top: normalizedPosition * 8,
          zIndex: visibleCards.length - stackPosition,
        }
      case 'grid':
      case 'list':
        return {
          boxShadow: undefined,
          left: 0,
          rotate: 0,
          scale: 1,
          top: 0,
          zIndex: 1,
        }
    }
  }

  const containerStyles = {
    grid: 'grid grid-cols-1 sm:grid-cols-2 gap-3',
    list: 'flex flex-col gap-3',
    stack: 'relative h-96 w-full max-w-md mx-auto pt-4',
  }

  const displayCards =
    layout === 'stack' ? getStackOrder() : visibleCards.map((c, i) => ({ ...c, stackPosition: i }))

  const topCard =
    layout === 'stack' && displayCards.length > 0 ? displayCards[displayCards.length - 1] : null

  return (
    <div className={cn('space-y-4', className)}>
      {showLayoutToggle && (
        <div className='flex items-center justify-center gap-1 rounded-lg bg-secondary/50 p-1 w-fit mx-auto'>
          {(Object.keys(layoutIcons) as LayoutMode[]).map(mode => {
            const Icon = layoutIcons[mode]
            return (
              <button
                aria-label={`Switch to ${mode} layout`}
                className={cn(
                  'rounded-md p-2 transition-all',
                  layout === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                )}
                key={mode}
                onClick={() => handleLayoutChange(mode)}
                type='button'
              >
                <Icon className='h-4 w-4' />
              </button>
            )
          })}
        </div>
      )}

      <LayoutGroup>
        <motion.div className={cn(containerStyles[layout])} layout>
          <AnimatePresence mode='popLayout'>
            {displayCards.map(card => {
              const styles = getLayoutStyles(card.stackPosition)
              const isExpanded = expandedCard === card.id
              const isTopCard = layout === 'stack' && topCard?.id === card.id
              const isExiting = card.id === exitingCardId

              return (
                <motion.div
                  animate={{
                    opacity: isExiting ? 0 : 1,
                    rotate: isExiting ? (exitDirection === 'left' ? -20 : 20) : styles.rotate,
                    scale: isExpanded ? 1.02 : styles.scale,
                    x: isExiting ? (exitDirection === 'left' ? -300 : 300) : 0,
                    ...(!isExiting && { left: styles.left, top: styles.top }),
                    zIndex: styles.zIndex,
                  }}
                  className={cn(
                    'rounded-xl border border-border bg-card overflow-hidden',
                    'transition-shadow',
                    layout === 'stack' && 'absolute inset-x-0',
                    layout === 'stack' &&
                      isTopCard &&
                      'cursor-grab active:cursor-grabbing shadow-lg',
                    layout === 'stack' && !isTopCard && 'pointer-events-none',
                    (layout === 'grid' || layout === 'list') &&
                      'cursor-pointer hover:border-primary/50',
                    isExpanded && 'ring-2 ring-primary',
                  )}
                  drag={isTopCard && !isExiting ? 'x' : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.9}
                  exit={{
                    opacity: 0,
                    rotate: exitDirection === 'left' ? -20 : 20,
                    scale: 0.8,
                    x: exitDirection === 'left' ? -300 : 300,
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  key={card.id}
                  layoutId={card.id}
                  onClick={() => {
                    if (isDragging) return
                    if (layout !== 'stack') {
                      setExpandedCard(isExpanded ? null : card.id)
                    }
                    onCardClick?.(card)
                  }}
                  onDrag={(_, info) => x.set(info.offset.x)}
                  onDragEnd={(_, info) => handleDragEnd(card, info)}
                  onDragStart={() => setIsDragging(true)}
                  style={{
                    backgroundColor: card.color || undefined,
                    boxShadow: layout === 'stack' ? styles.boxShadow : undefined,
                  }}
                  transition={{
                    damping: 25,
                    stiffness: 300,
                    type: 'spring',
                  }}
                  whileDrag={{ cursor: 'grabbing', scale: 1.02 }}
                >
                  {isTopCard && <SwipeOverlay isDragging={isDragging} progress={swipeProgress} />}

                  {renderCard ? (
                    renderCard(card, layout)
                  ) : (
                    <DefaultCardContent card={card} layout={layout} />
                  )}

                  {layout !== 'stack' && (onSwipeLeft || onSwipeRight) && (
                    <div className='border-t border-border p-3'>
                      {renderActions ? (
                        renderActions(card, {
                          onAccept: () => handleAccept(card),
                          onReject: () => handleReject(card),
                        })
                      ) : (
                        <DefaultCardActions
                          onAccept={() => handleAccept(card)}
                          onReject={() => handleReject(card)}
                        />
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>

      {layout === 'stack' && visibleCards.length > 0 && (
        <div className='text-center space-y-2'>
          <p className='text-xs text-muted-foreground'>← Reject · Swipe · Save →</p>
        </div>
      )}
    </div>
  )
}

function SwipeOverlay({
  progress,
  isDragging,
}: {
  progress: ReturnType<typeof useTransform<number, number>>
  isDragging: boolean
}) {
  const leftOpacity = useTransform(progress, [-1, -0.3, 0], [0.8, 0.3, 0])
  const rightOpacity = useTransform(progress, [0, 0.3, 1], [0, 0.3, 0.8])

  if (!isDragging) return null

  return (
    <>
      <motion.div
        className='absolute inset-0 bg-red-500 pointer-events-none z-10 flex items-center justify-center'
        style={{ opacity: leftOpacity }}
      >
        <div className='bg-white rounded-full p-3'>
          <X className='h-8 w-8 text-red-500' />
        </div>
      </motion.div>
      <motion.div
        className='absolute inset-0 bg-green-500 pointer-events-none z-10 flex items-center justify-center'
        style={{ opacity: rightOpacity }}
      >
        <div className='bg-white rounded-full p-3'>
          <Check className='h-8 w-8 text-green-500' />
        </div>
      </motion.div>
    </>
  )
}

function DefaultCardContent({ card, layout }: { card: CardData; layout: LayoutMode }) {
  return (
    <div className='p-4'>
      <div className='flex items-start gap-3'>
        {card.icon && (
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground'>
            {card.icon}
          </div>
        )}
        <div className='min-w-0 flex-1'>
          <h3 className='font-semibold text-card-foreground truncate'>{card.title}</h3>
          {card.description && (
            <p
              className={cn(
                'text-sm text-muted-foreground mt-1',
                layout === 'stack' && 'line-clamp-3',
                layout === 'grid' && 'line-clamp-2',
                layout === 'list' && 'line-clamp-1',
              )}
            >
              {card.description}
            </p>
          )}
        </div>
      </div>
      {card.content}
    </div>
  )
}

function DefaultCardActions({
  onAccept,
  onReject,
}: {
  onAccept: () => void
  onReject: () => void
}) {
  return (
    <div className='flex gap-2'>
      <button
        className='flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors text-sm'
        onClick={e => {
          e.stopPropagation()
          onReject()
        }}
        type='button'
      >
        <X className='h-4 w-4' />
        Skip
      </button>
      <button
        className='flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border hover:bg-green-50 hover:border-green-200 hover:text-green-600 transition-colors text-sm'
        onClick={e => {
          e.stopPropagation()
          onAccept()
        }}
        type='button'
      >
        <Check className='h-4 w-4' />
        Save
      </button>
    </div>
  )
}

export { MorphingCardStack as Component }
