# 🛠️ Development Guide

This guide covers development practices, architecture decisions, and contribution guidelines for the Modern Real Estate Platform.

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Homepage
│   ├── login/             # Authentication pages
│   └── properties/        # Property-related pages
├── components/            # Reusable UI components
│   ├── 3D/               # 3D scene components
│   ├── Layout/           # Layout components
│   ├── ErrorBoundary.tsx # Error handling
│   └── LoadingSpinner.tsx
├── config/               # Application configuration
│   └── app.ts           # Centralized config
├── contexts/            # React contexts
│   └── AuthContext.tsx  # Authentication state
├── data/               # Mock data and databases
│   ├── materialsDatabase.ts
│   └── mockData.ts
├── lib/                # Utility functions
│   └── utils.ts
└── types/              # TypeScript definitions
    └── index.ts
```

## 🎯 Architecture Principles

### 1. **Component Composition**
- Use composition over inheritance
- Keep components small and focused
- Prefer function components with hooks

### 2. **State Management**
- Use React Context for global state
- Local state for component-specific data
- Custom hooks for complex state logic

### 3. **3D Scene Management**
- Separate 3D logic from UI components
- Use React Three Fiber patterns
- Implement proper cleanup and error handling

### 4. **Configuration-Driven**
- Centralize configuration in `src/config/app.ts`
- Use environment variables for deployment-specific settings
- Make features configurable

## 🚀 Development Workflow

### 1. **Setup**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run type checking
npm run type-check

# Run linting
npm run lint
```

### 2. **Code Quality**
- **TypeScript**: Strict mode enabled, no `any` types
- **ESLint**: Configured for Next.js and React best practices
- **Prettier**: Code formatting (via ESLint)
- **Error Boundaries**: Catch and handle errors gracefully

### 3. **Testing Strategy**
- Unit tests for utility functions
- Component tests for UI components
- Integration tests for 3D scenes
- E2E tests for critical user flows

## 🎨 Design System

### **Colors**
```typescript
// Primary colors
primary: '#3B82F6'    // Blue
secondary: '#8B5CF6'  // Purple
accent: '#10B981'     // Green

// Neutral colors
background: '#000000' // Black
surface: 'rgba(255, 255, 255, 0.1)' // Glass
text: '#FFFFFF'       // White
```

### **Typography**
- **Font**: Inter (Google Fonts)
- **Scale**: 12px, 14px, 16px, 18px, 20px, 24px, 32px
- **Weights**: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

### **Spacing**
- **Scale**: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px
- **Consistent**: Use Tailwind spacing classes

### **Components**
- **Glassmorphism**: `bg-white/10 backdrop-blur-xl border-white/20`
- **Shadows**: `shadow-2xl` for depth
- **Borders**: `rounded-2xl` for modern look
- **Animations**: Framer Motion for smooth transitions

## 🎮 3D Development

### **Scene Architecture**
```typescript
// Scene3D.tsx - Main 3D scene
// ├── House3D - 3D model component
// ├── CameraController - First-person navigation
// ├── Lighting - Realistic lighting setup
// ├── Environment - Sky and atmosphere
// └── PostProcessing - Visual effects
```

### **Navigation System**
- **WASD**: Movement controls
- **Mouse**: Look around
- **Collision Detection**: Prevent walking through walls
- **Room Teleportation**: Quick navigation via floor plan

### **Material System**
- **Procedural Textures**: Generated fallbacks
- **Real-time Updates**: Live material changes
- **Pricing Integration**: Dynamic cost calculation
- **Category-based**: Organized by material type

### **Performance Optimization**
- **LOD (Level of Detail)**: Reduce complexity at distance
- **Frustum Culling**: Only render visible objects
- **Texture Compression**: Optimize memory usage
- **Frame Rate Monitoring**: Maintain 60 FPS

## 🔧 Configuration Management

### **Environment Variables**
```bash
# Development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_3D=true
NEXT_PUBLIC_3D_QUALITY=high

# Production
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_ENABLE_3D=true
NEXT_PUBLIC_3D_QUALITY=high
```

### **Feature Flags**
```typescript
// In src/config/app.ts
export const features = {
  enable3D: process.env.NEXT_PUBLIC_ENABLE_3D !== 'false',
  enableAnalytics: process.env.NEXT_PUBLIC_GA_ID !== undefined,
  enablePostProcessing: true,
}
```

## 🐛 Error Handling

### **Error Boundaries**
- **Global**: Catch all unhandled errors
- **Component**: Isolate 3D scene errors
- **Fallback UI**: User-friendly error messages

### **Error Types**
```typescript
// 3D Model Loading Errors
if (error || modelError) {
  return <ModelErrorFallback />
}

// Network Errors
try {
  const data = await fetchData()
} catch (error) {
  console.error('Network error:', error)
  setError('Failed to load data')
}

// Validation Errors
if (!isValidInput(input)) {
  throw new Error('Invalid input provided')
}
```

## 📱 Responsive Design

### **Breakpoints**
```css
/* Mobile First */
sm: 640px   /* Small devices */
md: 768px   /* Medium devices */
lg: 1024px  /* Large devices */
xl: 1280px  /* Extra large devices */
2xl: 1536px /* 2X large devices */
```

### **3D Responsiveness**
- **Canvas Sizing**: Responsive to container
- **Touch Controls**: Mobile-friendly navigation
- **Performance**: Lower quality on mobile devices

## 🚀 Performance Guidelines

### **Bundle Optimization**
- **Code Splitting**: Lazy load 3D components
- **Tree Shaking**: Remove unused code
- **Image Optimization**: Next.js Image component
- **Compression**: Gzip/Brotli compression

### **3D Performance**
- **Frame Rate**: Target 60 FPS
- **Memory Usage**: Monitor texture memory
- **GPU Usage**: Optimize shader complexity
- **Loading Times**: Progressive loading

### **Monitoring**
```typescript
// Performance monitoring
const startTime = performance.now()
// ... operation
const endTime = performance.now()
console.log(`Operation took ${endTime - startTime} milliseconds`)
```

## 🧪 Testing Strategy

### **Unit Tests**
```typescript
// utils.test.ts
import { formatPrice } from './utils'

describe('formatPrice', () => {
  it('formats price correctly', () => {
    expect(formatPrice(1000000)).toBe('$1,000,000')
  })
})
```

### **Component Tests**
```typescript
// MaterialPanel.test.tsx
import { render, screen } from '@testing-library/react'
import MaterialPanel from './MaterialPanel'

test('renders material panel', () => {
  render(<MaterialPanel isOpen={true} />)
  expect(screen.getByText('Customize Materials')).toBeInTheDocument()
})
```

### **3D Scene Tests**
```typescript
// Scene3D.test.tsx
import { render } from '@testing-library/react'
import Scene3D from './Scene3D'

test('renders 3D scene without errors', () => {
  const { container } = render(<Scene3D />)
  expect(container.querySelector('canvas')).toBeInTheDocument()
})
```

## 📦 Deployment

### **Build Process**
```bash
# Production build
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Clean build
npm run clean && npm run build
```

### **Environment Setup**
1. **Development**: `npm run dev`
2. **Staging**: `npm run build && npm start`
3. **Production**: Deploy to Vercel/Netlify

### **Monitoring**
- **Error Tracking**: Sentry integration
- **Analytics**: Google Analytics
- **Performance**: Web Vitals monitoring

## 🤝 Contributing

### **Code Style**
- **Formatting**: Prettier + ESLint
- **Naming**: camelCase for variables, PascalCase for components
- **Comments**: JSDoc for functions, inline for complex logic
- **Imports**: Organized and grouped

### **Git Workflow**
1. **Feature Branch**: `git checkout -b feature/your-feature`
2. **Commit Messages**: Conventional commits
3. **Pull Request**: Detailed description and testing
4. **Code Review**: Required before merging

### **Pull Request Template**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Component tests pass
- [ ] Manual testing completed

## Screenshots
Add screenshots if applicable
```

## 📚 Resources

### **Documentation**
- [Next.js Documentation](https://nextjs.org/docs)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [Three.js Documentation](https://threejs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

### **Tools**
- **VS Code Extensions**: ES7+ React/Redux/React-Native snippets, Tailwind CSS IntelliSense
- **Browser DevTools**: React DevTools, Three.js Inspector
- **Performance**: Chrome DevTools Performance tab

### **Learning Resources**
- [React Patterns](https://reactpatterns.com/)
- [Three.js Journey](https://threejs-journey.com/)
- [WebGL Fundamentals](https://webglfundamentals.org/)

---

## 🆘 Troubleshooting

### **Common Issues**

#### **3D Model Not Loading**
```typescript
// Check model path and format
const { scene, error } = useGLTF('/models/House.glb')
if (error) {
  console.error('Model loading error:', error)
}
```

#### **Performance Issues**
```typescript
// Monitor frame rate
useFrame((state) => {
  const fps = 1 / state.clock.getDelta()
  if (fps < 30) {
    console.warn('Low FPS detected:', fps)
  }
})
```

#### **Memory Leaks**
```typescript
// Cleanup in useEffect
useEffect(() => {
  return () => {
    // Cleanup textures, geometries, etc.
    texture.dispose()
    geometry.dispose()
  }
}, [])
```

### **Getting Help**
- **GitHub Issues**: Report bugs and request features
- **Discord**: Community support
- **Documentation**: Check this guide first
- **Code Review**: Ask team members for help

