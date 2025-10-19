"use client"

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import TraditionalViewer from "./TraditionalViewer"

interface ListingUnitPayload {
  listing: any
  unit: any
  agent?: {
    id: string
    name: string | null
    email: string
    phone?: string | null
    jobTitle?: string | null
    agencyName?: string | null
    avatarUrl?: string | null
  } | null
}

export default function PublicListingPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ListingUnitPayload | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      try {
        setStatus('Loading property details...')
        const response = await fetch(`/api/listings/${id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch listing')
        }
        const result = await response.json()
        setData(result)
        setStatus('')
      } catch (error) {
        console.error('Error fetching listing:', error)
        setStatus('Error loading property details')
      }
    }

    fetchData()
  }, [id])

  if (status) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{status}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-600">
          <p>Property not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TraditionalViewer listing={data} />
    </div>
  )
}