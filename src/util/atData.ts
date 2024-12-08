import { Post } from '../db/schema'

export interface PostLookupResponse {
  result: {
    uri: string
    cid: string
    value: {
      text: string
      $type: 'app.bsky.feed.post'
      langs: string[]
      createdAt: string
    }
  }
}

interface LikeRecord {
  uri: string
  cid: string
  value: {
    $type: 'app.bsky.feed.like'
    subject: {
      cid: string
      uri: string
    }
    createdAt: string
  }
}

type LikeRecords = LikeRecord[]

const CACHE_EXPIRY_MS = 5 * 60 * 1000
const likedPostsCache = new Map<string, { posts: Post[]; timestamp: number }>()
const CACHE_KEY = 'liked_posts'

export const getLikedPosts = async (): Promise<Post[]> => {
  const cached = likedPostsCache.get(CACHE_KEY)
  const now = Date.now()

  if (cached && now - cached.timestamp < CACHE_EXPIRY_MS) {
    return cached.posts
  }

  const response = await fetch(
    'https://atexplore.social/api/explore/at/whiteside.io/app.bsky.feed.like',
  )
  const myLikesJson: any = (await response.json()) as LikeRecords
  const myLikeValues = myLikesJson?.map((like) => like.value)
  const myLikesRecords = await Promise.all(
    myLikeValues.map(async (like) => {
      const record = await fetch(
        `https://atexplore.social/api/explore/at/lookup/record?uri=${encodeURIComponent(
          like.subject.uri,
        )}`,
      )
      const json = (await record.json()) as { result: PostLookupResponse }
      return json?.result
    }),
  )

  const likedPosts: Post[] =
    myLikesRecords
      ?.filter((record) => record !== undefined)
      .map((record) => {
        return {
          uri: record?.uri ?? '',
          cid: record?.cid ?? '',
          indexedAt: record?.value.createdAt ?? '',
          text: record?.value.text ?? '',
          altText: record?.value.embed?.images?.[0]?.alt || null,
        }
      }) || []

  likedPostsCache.set(CACHE_KEY, {
    posts: likedPosts,
    timestamp: now,
  })

  return likedPosts
}
