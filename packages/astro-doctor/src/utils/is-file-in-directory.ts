import { isAbsolute, relative, sep } from 'node:path'

export const isFileInDirectory = (filePath: string, directory: string): boolean => {
  const relativePath = relative(directory, filePath)

  return relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
}
