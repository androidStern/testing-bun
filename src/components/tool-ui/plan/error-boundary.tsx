'use client'

import { ToolUIErrorBoundary, type ToolUIErrorBoundaryProps } from '../shared'

export function PlanErrorBoundary(props: Omit<ToolUIErrorBoundaryProps, 'componentName'>) {
  const { children, ...rest } = props
  return (
    <ToolUIErrorBoundary componentName='Plan' {...rest}>
      {children}
    </ToolUIErrorBoundary>
  )
}
