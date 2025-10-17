export interface Material {
  id: string
  name: string
  category: MaterialCategory
  type: string
  price: number
  priceUnit: 'per_sqft' | 'per_piece' | 'per_linear_foot' | 'per_sqft_wall'
  image: string
  description: string
  specifications: {
    color?: string
    finish?: string
    durability?: string
    maintenance?: string
    ecoFriendly?: boolean
  }
  availability: 'in_stock' | 'limited' | 'custom_order'
  leadTime?: number // days
}

export type MaterialCategory = 
  | 'flooring'
  | 'wall_paint'
  | 'wallpaper'
  | 'tiles'
  | 'kitchen_cabinets'
  | 'kitchen_countertops'
  | 'kitchen_appliances'
  | 'bathroom_fixtures'
  | 'bathroom_tiles'
  | 'lighting'
  | 'curtains'
  | 'furniture'
  | 'doors'
  | 'windows'
  | 'hardware'

export interface CustomizationOption {
  id: string
  name: string
  category: MaterialCategory
  materials: Material[]
  defaultMaterial: string
  area?: number // in sqft
  quantity?: number
}

export const materialsDatabase: Material[] = [
  // FLOORING
  {
    id: 'floor_1',
    name: 'Oak Hardwood',
    category: 'flooring',
    type: 'Hardwood',
    price: 8.50,
    priceUnit: 'per_sqft',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300&h=200&fit=crop',
    description: 'Premium oak hardwood flooring with natural grain patterns',
    specifications: {
      color: 'Natural Oak',
      finish: 'Matte',
      durability: 'High',
      maintenance: 'Easy',
      ecoFriendly: true
    },
    availability: 'in_stock',
    leadTime: 3
  },
  {
    id: 'floor_2',
    name: 'Marble Tiles',
    category: 'flooring',
    type: 'Natural Stone',
    price: 15.00,
    priceUnit: 'per_sqft',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300&h=200&fit=crop',
    description: 'Luxurious Carrara marble tiles with elegant veining',
    specifications: {
      color: 'White with Gray Veins',
      finish: 'Polished',
      durability: 'Very High',
      maintenance: 'Moderate',
      ecoFriendly: true
    },
    availability: 'in_stock',
    leadTime: 7
  },
  {
    id: 'floor_3',
    name: 'Luxury Vinyl Plank',
    category: 'flooring',
    type: 'Vinyl',
    price: 4.25,
    priceUnit: 'per_sqft',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300&h=200&fit=crop',
    description: 'Waterproof luxury vinyl plank with wood grain texture',
    specifications: {
      color: 'Gray Oak',
      finish: 'Textured',
      durability: 'High',
      maintenance: 'Very Easy',
      ecoFriendly: false
    },
    availability: 'in_stock',
    leadTime: 2
  },

  // WALL PAINT
  {
    id: 'paint_1',
    name: 'Benjamin Moore Classic Gray',
    category: 'wall_paint',
    type: 'Interior Paint',
    price: 0.15,
    priceUnit: 'per_sqft_wall',
    image: 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?w=300&h=200&fit=crop',
    description: 'Premium interior paint with excellent coverage and durability',
    specifications: {
      color: 'Classic Gray',
      finish: 'Eggshell',
      durability: 'High',
      maintenance: 'Easy',
      ecoFriendly: true
    },
    availability: 'in_stock',
    leadTime: 1
  },
  {
    id: 'paint_2',
    name: 'Sherwin Williams Naval',
    category: 'wall_paint',
    type: 'Interior Paint',
    price: 0.18,
    priceUnit: 'per_sqft_wall',
    image: 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?w=300&h=200&fit=crop',
    description: 'Deep navy blue paint perfect for accent walls',
    specifications: {
      color: 'Navy Blue',
      finish: 'Satin',
      durability: 'High',
      maintenance: 'Easy',
      ecoFriendly: true
    },
    availability: 'in_stock',
    leadTime: 1
  },

  // KITCHEN CABINETS
  {
    id: 'cabinet_1',
    name: 'Shaker White Cabinets',
    category: 'kitchen_cabinets',
    type: 'Custom Cabinets',
    price: 180.00,
    priceUnit: 'per_linear_foot',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=200&fit=crop',
    description: 'Classic shaker-style cabinets in crisp white finish',
    specifications: {
      color: 'White',
      finish: 'Semi-Gloss',
      durability: 'Very High',
      maintenance: 'Easy',
      ecoFriendly: true
    },
    availability: 'custom_order',
    leadTime: 14
  },
  {
    id: 'cabinet_2',
    name: 'Modern Gray Cabinets',
    category: 'kitchen_cabinets',
    type: 'Custom Cabinets',
    price: 220.00,
    priceUnit: 'per_linear_foot',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=200&fit=crop',
    description: 'Sleek modern cabinets with soft-close hardware',
    specifications: {
      color: 'Charcoal Gray',
      finish: 'Matte',
      durability: 'Very High',
      maintenance: 'Easy',
      ecoFriendly: true
    },
    availability: 'custom_order',
    leadTime: 14
  },

  // KITCHEN COUNTERTOPS
  {
    id: 'counter_1',
    name: 'Quartz Calacatta',
    category: 'kitchen_countertops',
    type: 'Engineered Stone',
    price: 85.00,
    priceUnit: 'per_sqft',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=200&fit=crop',
    description: 'Premium quartz countertop with marble-like appearance',
    specifications: {
      color: 'White with Gray Veins',
      finish: 'Polished',
      durability: 'Very High',
      maintenance: 'Very Easy',
      ecoFriendly: false
    },
    availability: 'in_stock',
    leadTime: 5
  },
  {
    id: 'counter_2',
    name: 'Butcher Block',
    category: 'kitchen_countertops',
    type: 'Wood',
    price: 45.00,
    priceUnit: 'per_sqft',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=200&fit=crop',
    description: 'Natural maple butcher block countertop',
    specifications: {
      color: 'Natural Maple',
      finish: 'Food-Safe Oil',
      durability: 'High',
      maintenance: 'Moderate',
      ecoFriendly: true
    },
    availability: 'in_stock',
    leadTime: 3
  },

  // BATHROOM FIXTURES
  {
    id: 'fixture_1',
    name: 'Kohler Veil Toilet',
    category: 'bathroom_fixtures',
    type: 'Toilet',
    price: 450.00,
    priceUnit: 'per_piece',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=300&h=200&fit=crop',
    description: 'Wall-hung toilet with concealed tank and soft-close seat',
    specifications: {
      color: 'White',
      finish: 'Glossy',
      durability: 'Very High',
      maintenance: 'Easy',
      ecoFriendly: true
    },
    availability: 'in_stock',
    leadTime: 3
  },
  {
    id: 'fixture_2',
    name: 'Rainfall Shower Head',
    category: 'bathroom_fixtures',
    type: 'Shower',
    price: 320.00,
    priceUnit: 'per_piece',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=300&h=200&fit=crop',
    description: 'Large rainfall shower head with multiple spray patterns',
    specifications: {
      color: 'Chrome',
      finish: 'Brushed',
      durability: 'High',
      maintenance: 'Easy',
      ecoFriendly: true
    },
    availability: 'in_stock',
    leadTime: 2
  },

  // LIGHTING
  {
    id: 'light_1',
    name: 'Pendant Chandelier',
    category: 'lighting',
    type: 'Pendant',
    price: 280.00,
    priceUnit: 'per_piece',
    image: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=300&h=200&fit=crop',
    description: 'Modern 3-light pendant chandelier with brass finish',
    specifications: {
      color: 'Brass',
      finish: 'Polished',
      durability: 'High',
      maintenance: 'Easy',
      ecoFriendly: true
    },
    availability: 'in_stock',
    leadTime: 2
  },
  {
    id: 'light_2',
    name: 'Recessed LED Lights',
    category: 'lighting',
    type: 'Recessed',
    price: 45.00,
    priceUnit: 'per_piece',
    image: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=300&h=200&fit=crop',
    description: 'Energy-efficient LED recessed lights with dimmable control',
    specifications: {
      color: 'White',
      finish: 'Matte',
      durability: 'Very High',
      maintenance: 'Minimal',
      ecoFriendly: true
    },
    availability: 'in_stock',
    leadTime: 1
  },

  // CURTAINS
  {
    id: 'curtain_1',
    name: 'Linen Drapes',
    category: 'curtains',
    type: 'Window Treatment',
    price: 25.00,
    priceUnit: 'per_linear_foot',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300&h=200&fit=crop',
    description: 'Natural linen curtains with thermal backing',
    specifications: {
      color: 'Natural Linen',
      finish: 'Textured',
      durability: 'High',
      maintenance: 'Easy',
      ecoFriendly: true
    },
    availability: 'in_stock',
    leadTime: 3
  },

  // FURNITURE
  {
    id: 'furniture_1',
    name: 'Sectional Sofa',
    category: 'furniture',
    type: 'Living Room',
    price: 1200.00,
    priceUnit: 'per_piece',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300&h=200&fit=crop',
    description: 'Modern L-shaped sectional sofa in gray fabric',
    specifications: {
      color: 'Gray',
      finish: 'Fabric',
      durability: 'High',
      maintenance: 'Easy',
      ecoFriendly: true
    },
    availability: 'in_stock',
    leadTime: 7
  }
]

export const customizationOptions: CustomizationOption[] = [
  {
    id: 'living_room_floor',
    name: 'Living Room Flooring',
    category: 'flooring',
    materials: materialsDatabase.filter(m => m.category === 'flooring'),
    defaultMaterial: 'floor_1',
    area: 300
  },
  {
    id: 'living_room_walls',
    name: 'Living Room Walls',
    category: 'wall_paint',
    materials: materialsDatabase.filter(m => m.category === 'wall_paint'),
    defaultMaterial: 'paint_1',
    area: 400
  },
  {
    id: 'kitchen_cabinets',
    name: 'Kitchen Cabinets',
    category: 'kitchen_cabinets',
    materials: materialsDatabase.filter(m => m.category === 'kitchen_cabinets'),
    defaultMaterial: 'cabinet_1',
    quantity: 12
  },
  {
    id: 'kitchen_countertops',
    name: 'Kitchen Countertops',
    category: 'kitchen_countertops',
    materials: materialsDatabase.filter(m => m.category === 'kitchen_countertops'),
    defaultMaterial: 'counter_1',
    area: 25
  },
  {
    id: 'bathroom_fixtures',
    name: 'Bathroom Fixtures',
    category: 'bathroom_fixtures',
    materials: materialsDatabase.filter(m => m.category === 'bathroom_fixtures'),
    defaultMaterial: 'fixture_1',
    quantity: 1
  },
  {
    id: 'lighting',
    name: 'Lighting',
    category: 'lighting',
    materials: materialsDatabase.filter(m => m.category === 'lighting'),
    defaultMaterial: 'light_1',
    quantity: 1
  },
  {
    id: 'curtains',
    name: 'Window Treatments',
    category: 'curtains',
    materials: materialsDatabase.filter(m => m.category === 'curtains'),
    defaultMaterial: 'curtain_1',
    quantity: 4
  },
  {
    id: 'furniture',
    name: 'Living Room Furniture',
    category: 'furniture',
    materials: materialsDatabase.filter(m => m.category === 'furniture'),
    defaultMaterial: 'furniture_1',
    quantity: 1
  }
]

export function calculateMaterialCost(material: Material, area?: number, quantity?: number): number {
  switch (material.priceUnit) {
    case 'per_sqft':
      return material.price * (area || 1)
    case 'per_piece':
      return material.price * (quantity || 1)
    case 'per_linear_foot':
      return material.price * (area || 1)
    case 'per_sqft_wall':
      return material.price * (area || 1)
    default:
      return material.price
  }
}

export function getMaterialById(id: string): Material | undefined {
  return materialsDatabase.find(material => material.id === id)
}

export function getMaterialsByCategory(category: MaterialCategory): Material[] {
  return materialsDatabase.filter(material => material.category === category)
}

