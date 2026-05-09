import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import type { FriendItem } from '@/interface/friend'

const FRIENDS_YAML_PATH = path.resolve(process.cwd(), 'src/data/friends.yaml')

export function loadFriends(): FriendItem[] {
  try {
    const raw = fs.readFileSync(FRIENDS_YAML_PATH, 'utf-8')
    const data = yaml.load(raw)
    if (Array.isArray(data)) return data as FriendItem[]
    return []
  } catch {
    return []
  }
}
