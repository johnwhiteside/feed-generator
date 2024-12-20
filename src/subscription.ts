import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        /* @ts-ignore */
        const postWithImageAlt = create.record.embed?.images?.find(
          (image) => image.alt,
        )
        return (
          (create.record.text.toLowerCase().includes('pizza') ||
            postWithImageAlt?.alt.toLowerCase().includes('pizza')) &&
          create.record.langs?.includes('en')
        )
      })
      .map((create) => {
        /* @ts-ignore */
        const postWithImageAlt = create.record.embed?.images?.find(
          (image) => image.alt,
        )
        const post = {
          uri: create.uri,
          cid: create.cid,
          indexedAt: new Date().toISOString(),
          text: create.record.text,
          altText: postWithImageAlt?.alt ?? null,
        }
        return post
      })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}
