import fs from 'fs/promises'
import path from 'path'

import { prisma } from './database'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const PROCESSED_DIR = path.join(process.cwd(), 'processed')
const MODELS_DIR = path.join(process.cwd(), 'models')

// Ensure directories exist
export async function ensureDirectories() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  await fs.mkdir(PROCESSED_DIR, { recursive: true })
  await fs.mkdir(MODELS_DIR, { recursive: true })
}

export async function saveUploadedFile(
  file: Buffer,
  filename: string,
  mimeType: string,
  userId: string,
  projectId?: string
) {
  await ensureDirectories()
  
  const timestamp = Date.now()
  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = path.join(UPLOAD_DIR, `${timestamp}_${safeFilename}`)
  
  await fs.writeFile(filePath, file)
  
  const fileUpload = await prisma.fileUpload.create({
    data: {
      filename: safeFilename,
      originalName: filename,
      filePath,
      fileSize: file.length,
      mimeType,
      userId,
      projectId
    }
  })
  
  return fileUpload
}

export async function saveProcessedFile(
  fileId: string,
  processedData: Buffer,
  fileExtension: string
) {
  const fileUpload = await prisma.fileUpload.findUnique({
    where: { id: fileId }
  })
  
  if (!fileUpload) {
    throw new Error('File upload not found')
  }
  
  const timestamp = Date.now()
  const processedFilename = `${timestamp}_processed.${fileExtension}`
  const processedFilePath = path.join(PROCESSED_DIR, processedFilename)
  
  await fs.writeFile(processedFilePath, processedData)
  
  const updatedFile = await prisma.fileUpload.update({
    where: { id: fileId },
    data: {
      processedFilePath,
      status: 'COMPLETED'
    }
  })
  
  return updatedFile
}

export async function saveModelFile(
  fileId: string,
  modelData: Buffer,
  fileExtension: string
) {
  const fileUpload = await prisma.fileUpload.findUnique({
    where: { id: fileId }
  })
  
  if (!fileUpload) {
    throw new Error('File upload not found')
  }
  
  const timestamp = Date.now()
  const modelFilename = `${timestamp}_model.${fileExtension}`
  const modelFilePath = path.join(MODELS_DIR, modelFilename)
  
  await fs.writeFile(modelFilePath, modelData)
  
  const updatedFile = await prisma.fileUpload.update({
    where: { id: fileId },
    data: {
      glbFilePath: modelFilePath,
      status: 'COMPLETED'
    }
  })
  
  return updatedFile
}

export async function getFileById(fileId: string) {
  return prisma.fileUpload.findUnique({
    where: { id: fileId }
  })
}

export async function getUserFiles(userId: string) {
  return prisma.fileUpload.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  })
}

export async function deleteFile(fileId: string) {
  const file = await prisma.fileUpload.findUnique({
    where: { id: fileId }
  })
  
  if (!file) {
    throw new Error('File not found')
  }
  
  // Delete physical files
  try {
    if (file.filePath) await fs.unlink(file.filePath)
    if (file.processedFilePath) await fs.unlink(file.processedFilePath)
    if (file.glbFilePath) await fs.unlink(file.glbFilePath)
  } catch (error) {
    console.warn('Error deleting physical files:', error)
  }
  
  // Delete database record
  return prisma.fileUpload.delete({
    where: { id: fileId }
  })
}
