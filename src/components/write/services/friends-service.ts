import {
  readTextFileFromRepo,
  toBase64Utf8,
  createBlob,
  createTree,
  createCommit,
  updateRef,
  getRef,
  getCommit,
  type TreeItem
} from '@/lib/github-client'
import { fileToBase64NoPrefix } from '@/lib/file-utils'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import yaml from 'js-yaml'
import { toast } from 'sonner'
import type { FriendItem } from '@/interface/friend'

const FRIENDS_FILE_PATH = 'src/data/friends.yaml'

export async function loadFriendsFromGitHub(): Promise<FriendItem[]> {
  let token: string | undefined
  try {
    token = await getAuthToken()
  } catch {
    // try public access
  }
  const content = await readTextFileFromRepo(
    token,
    GITHUB_CONFIG.OWNER,
    GITHUB_CONFIG.REPO,
    FRIENDS_FILE_PATH,
    GITHUB_CONFIG.BRANCH
  )
  if (!content) return []
  try {
    const data = yaml.load(content)
    if (Array.isArray(data)) return data as FriendItem[]
    return []
  } catch {
    return []
  }
}

export async function saveFriendsToGitHub(
  friends: FriendItem[],
  pendingAvatars?: Record<number, { file: File; previewUrl: string }>
): Promise<void> {
  const token = await getAuthToken()
  const toastId = toast.loading('🚀 正在保存友链数据...')

  try {
    const treeItems: TreeItem[] = []

    // Handle avatar image uploads first
    if (pendingAvatars && Object.keys(pendingAvatars).length > 0) {
      for (const [indexStr, { file }] of Object.entries(pendingAvatars)) {
        const index = parseInt(indexStr)
        const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
        const avatarPath = `public/images/friends/avatar-${index}.${ext}`

        toast.loading(`正在上传头像 ${index + 1}...`, { id: toastId })

        const base64Content = await fileToBase64NoPrefix(file)
        const { sha: blobSha } = await createBlob(
          token,
          GITHUB_CONFIG.OWNER,
          GITHUB_CONFIG.REPO,
          base64Content,
          'base64'
        )

        treeItems.push({
          path: avatarPath,
          mode: '100644',
          type: 'blob',
          sha: blobSha
        })

        friends[index].avatar = `/images/friends/avatar-${index}.${ext}`
      }
    }

    // Serialize friends to YAML and create blob
    const yamlContent = yaml.dump(friends, { lineWidth: -1, noRefs: true })
    const base64Content = toBase64Utf8(yamlContent)

    toast.loading('正在创建文件 Blob...', { id: toastId })
    const { sha: yamlBlobSha } = await createBlob(
      token,
      GITHUB_CONFIG.OWNER,
      GITHUB_CONFIG.REPO,
      base64Content,
      'base64'
    )

    treeItems.push({
      path: FRIENDS_FILE_PATH,
      mode: '100644',
      type: 'blob',
      sha: yamlBlobSha
    })

    toast.loading('正在获取分支信息...', { id: toastId })
    const refName = `heads/${GITHUB_CONFIG.BRANCH}`
    const ref = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, refName)
    const currentCommitSha = ref.sha

    const commit = await getCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, currentCommitSha)
    const baseTreeSha = commit.tree.sha

    toast.loading('🌳 正在构建文件树...', { id: toastId })
    const { sha: newTreeSha } = await createTree(
      token,
      GITHUB_CONFIG.OWNER,
      GITHUB_CONFIG.REPO,
      treeItems,
      baseTreeSha
    )

    toast.loading('💾 正在提交更改...', { id: toastId })
    const { sha: newCommitSha } = await createCommit(
      token,
      GITHUB_CONFIG.OWNER,
      GITHUB_CONFIG.REPO,
      'chore(friends): update friends data',
      newTreeSha,
      [currentCommitSha]
    )

    toast.loading('🔄 正在同步远程分支...', { id: toastId })
    await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, refName, newCommitSha)

    toast.success('🎉 友链数据更新成功！', {
      id: toastId,
      description: '更改已推送到仓库，GitHub Actions 将会自动重新部署。'
    })
  } catch (error: any) {
    console.error(error)
    toast.error('❌ 保存失败', {
      id: toastId,
      description: error.message || '发生了未知错误，请重试'
    })
    throw error
  }
}
