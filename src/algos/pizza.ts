import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { getLikedPosts } from '../util/atData'

export const shortname = 'pizza'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  let builder = ctx.db
    .selectFrom('post')
    .selectAll()
    .orderBy('indexedAt', 'desc')
    .orderBy('cid', 'desc')
    .limit(params.limit)

  const res = await builder.execute()

  try {
    const likedPosts = await getLikedPosts()
    const responsePosts = res || []

    // Merge posts and sort them with weighted randomization
    const mergedPosts = [...likedPosts, ...responsePosts]
      .sort((a, b) => {
        // Give liked posts a higher weight (70% chance to appear earlier)
        const isALiked = likedPosts.some((post) => post.uri === a.uri)
        const isBLiked = likedPosts.some((post) => post.uri === b.uri)

        if (isALiked && !isBLiked) return Math.random() - 0.3 // Bias towards front
        if (!isALiked && isBLiked) return Math.random() - 0.7 // Bias towards front
        return Math.random() - 0.5 // Regular random for same type
      })
      ?.filter((post) => {
        // const isLiked = likedPosts.some(
        //   (likedPost) => likedPost.uri === post.uri,
        // )
        return post.text.toLowerCase().includes('pizza')
        //   &&
        //   (isLiked /* @ts-ignore */ ||
        //     (post.altText?.toLowerCase()?.includes('pizza') ?? false))
      })
      .slice(0, params.limit)

    let cursor: string | undefined
    const last = mergedPosts.at(-1)
    if (last) {
      cursor = new Date(last.indexedAt).getTime().toString(10)
    }
    const feed = mergedPosts.map((post) => ({
      post: post.uri,
    }))

    return {
      cursor,
      feed,
    }
  } catch (e) {
    console.error(e)
    return {
      cursor: undefined,
      feed: [],
    }
  }
}
