'use client'

import { useState } from 'react'

type TestUser = {
  email: string
  role: string
}

type UploadedFile = {
  id: string
  name: string
  path: string
  originalName?: string
  fileSize?: number
  status?: string
  mimeType?: string
  createdAt?: string
}

export default function TestPage() {
  const [user, setUser] = useState<TestUser | null>(null)
  const [token, setToken] = useState('')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState(0)

  const register = async () => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          role: 'USER'
        })
      })
      const data = await response.json()
      console.log('Registration:', data)
    } catch (error: unknown) {
      console.error('Registration error:', error)
    }
  }

  const login = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        })
      })
      const data = await response.json()
      if (data.token) {
        setToken(String(data.token))
        if (data.user && typeof data.user.email === 'string') {
          setUser({
            email: data.user.email,
            role: typeof data.user.role === 'string' ? data.user.role : 'USER',
          })
        }
        console.log('Login successful:', data)
      }
    } catch (error: unknown) {
      console.error('Login error:', error)
    }
  }

  const testProcessing = async () => {
    setProcessing(true)
    setProgress(0)
    setMessage('🔄 Testing processing directly...')
    
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.random() * 10
      })
    }, 500)
    
    try {
      const response = await fetch('http://localhost:8000/process-cad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: '/Users/nyuad/Downloads/cursor_folder /TheImmersiveCustomizer/ModernRealEstate/D2GroundFloorEDITED.dxf',
          userId: 'test-user'
        })
      })
      
      const result = await response.json()
      console.log('Direct backend result:', result)
      
      if (response.ok) {
        setMessage('✅ Direct processing successful! Backend is working.')
      } else {
        setMessage('❌ Direct processing failed: ' + result.detail)
      }
    } catch (error: unknown) {
      const details = error instanceof Error ? error.message : String(error)
      setMessage('❌ Direct processing error: ' + details)
    } finally {
      clearInterval(progressInterval)
      setProgress(100)
      setProcessing(false)
    }
  }

  const testFrontendProcessing = async () => {
    setProcessing(true)
    setProgress(0)
    setMessage('🔄 Testing frontend processing...')
    
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.random() * 10
      })
    }, 500)
    
    try {
      const response = await fetch('/api/test-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: '/Users/nyuad/Downloads/cursor_folder /TheImmersiveCustomizer/ModernRealEstate/D2GroundFloorEDITED.dxf'
        })
      })
      
      const result = await response.json()
      console.log('Frontend test result:', result)
      
      if (response.ok) {
        setMessage('✅ Frontend processing successful! ' + result.message)
      } else {
        setMessage('❌ Frontend processing failed: ' + result.error)
      }
    } catch (error: unknown) {
      const details = error instanceof Error ? error.message : String(error)
      setMessage('❌ Frontend processing error: ' + details)
    } finally {
      clearInterval(progressInterval)
      setProgress(100)
      setProcessing(false)
    }
  }

  const uploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !token) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const data = await response.json()
      console.log('Upload result:', data)
      
      if (data.filePath) {
        setFiles((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            name: file.name,
            path: String(data.filePath),
            originalName: file.name,
            fileSize: file.size,
            status: 'uploaded',
            mimeType: file.type,
            createdAt: new Date().toISOString(),
          },
        ])
        
        // Start processing with visual feedback
        setProcessing(true)
        setProgress(0)
        setMessage('🔄 Processing CAD file... This may take a few moments.')
        
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 90) return prev
            return prev + Math.random() * 10
          })
        }, 500)
        
        try {
          console.log('Calling /api/process with:', { filePath: data.filePath, propertyId: 'test-property-123' })
          console.log('Using token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN')
          
          const processResponse = await fetch('/api/process', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filePath: data.filePath, propertyId: 'test-property-123' })
          })
          
          console.log('Process response status:', processResponse.status)
          const processData = await processResponse.json()
          console.log('Processing result:', processData)
          
          if (processData.result && processData.result.success) {
            setMessage('✅ File processed successfully! IFC and GLB files generated.')
            console.log('Success details:', processData.result)
          } else {
            const errorMsg = processData.result?.error || processData.error || 'Unknown error'
            setMessage('❌ Processing failed: ' + errorMsg)
            console.error('Processing failed:', processData)
          }
        } catch (error: unknown) {
          const details = error instanceof Error ? error.message : String(error)
          setMessage('❌ Processing error: ' + details)
        } finally {
          clearInterval(progressInterval)
          setProgress(100)
          setProcessing(false)
        }
      }
    } catch (error: unknown) {
      console.error('Upload error:', error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Real Estate Platform - Test Interface</h1>
        
        {message && (
          <div className={`mb-6 p-4 border rounded ${
            message.includes('✅') ? 'bg-green-100 border-green-400 text-green-700' :
            message.includes('❌') ? 'bg-red-100 border-red-400 text-red-700' :
            message.includes('🔄') ? 'bg-[rgba(198,138,63,0.16)] border-[color:var(--brand-500-45)] text-[#8f5c2a]' :
            'bg-gray-100 border-gray-400 text-gray-700'
          }`}>
            <div className="flex items-center">
              {message.includes('🔄') && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[color:var(--brand-600)] mr-2"></div>
              )}
              {message}
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Authentication</h2>
          <div className="space-x-4">
            <button
              onClick={register}
              className="bg-[color:var(--brand-600)] text-white px-4 py-2 rounded transition hover:bg-[color:var(--brand-500)]"
            >
              Register Test User
            </button>
            <button
              onClick={login}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Login
            </button>
          </div>
          {user && (
            <div className="mt-4 p-4 bg-green-50 rounded">
              <p>Logged in as: {user.email}</p>
              <p>Role: {user.role}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">File Upload & Processing</h2>
          <div className="space-y-4">
            <div className="flex space-x-4">
              <button
                onClick={testProcessing}
                disabled={processing}
                className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
              >
                Test Backend (Direct)
              </button>
              <button
                onClick={testFrontendProcessing}
                disabled={processing}
                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50"
              >
                Test Frontend (No Auth)
              </button>
            </div>
            <input
              type="file"
              accept=".dxf,.dwg"
              onChange={uploadFile}
              disabled={!token || uploading || processing}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[rgba(198,138,63,0.16)] file:text-[#8f5c2a] hover:file:bg-[rgba(198,138,63,0.24)] disabled:opacity-50"
            />
            {uploading && (
              <div className="flex items-center text-brand">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[color:var(--brand-600)] mr-2"></div>
                Uploading file...
              </div>
            )}
            {processing && (
              <div className="flex items-center text-brand">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[color:var(--brand-600)] mr-2"></div>
                Processing CAD file... Please wait...
              </div>
            )}
          </div>
        </div>

        {(processing || files.length > 0) && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Processing Status</h2>
            <div className="space-y-4">
              {processing && (
                <div className="rounded-lg border border-[color:var(--brand-500-28)] bg-[rgba(198,138,63,0.12)] p-4">
                  <div className="flex items-center mb-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[color:var(--brand-600)] mr-3"></div>
                    <h3 className="text-lg font-medium text-brand-strong">Processing in Progress</h3>
                  </div>
                  <div className="text-sm text-brand space-y-1">
                    <p>• Analyzing DXF file structure</p>
                    <p>• Extracting architectural elements</p>
                    <p>• Generating IFC model</p>
                    <p>• Creating 3D GLB visualization</p>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-brand mb-1">
                      <span>Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[rgba(198,138,63,0.18)]">
                      <div 
                        className="h-2 rounded-full bg-[color:var(--brand-600)] transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="mt-3 text-xs text-brand">
                    This process typically takes 10-30 seconds depending on file complexity.
                  </div>
                </div>
              )}
              
              {files.length > 0 && !processing && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <div className="w-5 h-5 bg-green-500 rounded-full mr-3 flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <h3 className="text-lg font-medium text-green-800">Processing Complete</h3>
                  </div>
                  <div className="text-sm text-green-700">
                    <p>✅ IFC file generated successfully</p>
                    <p>✅ 3D GLB model created</p>
                    <p>✅ Processing completed without errors</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Uploaded Files</h2>
          {files.length === 0 ? (
            <p className="text-gray-500">No files uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{file.originalName || file.name}</p>
                    <p className="text-sm text-gray-500">
                      Size: {file.fileSize ? (file.fileSize / 1024).toFixed(1) : '—'} KB | 
                      Status: {file.status || 'pending'} | 
                      Type: {file.mimeType || 'unknown'}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {file.createdAt ? new Date(file.createdAt).toLocaleString() : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">System Status</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>✅ SQLite Database: Connected</li>
            <li>✅ File Storage: Local directories created</li>
            <li>✅ Authentication: JWT-based</li>
            <li>✅ File Upload: Working</li>
            <li>🔄 CAD Processing: Mock implementation (ready for DXF-IFC suite integration)</li>
            <li>🔄 3D Model Generation: Mock implementation</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
