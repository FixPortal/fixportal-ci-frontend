import { createRoot } from 'react-dom/client'
import { CiBoard } from '@fix-portal/ci-frontend'
import type { CiBoardProps } from '@fix-portal/ci-frontend'
import '@fix-portal/ci-frontend/board.css'
import '@fix-portal/ci-frontend/tokens.css'

const props: CiBoardProps = { adminSignal: false }

createRoot(document.createElement('div')).render(<CiBoard {...props} />)
