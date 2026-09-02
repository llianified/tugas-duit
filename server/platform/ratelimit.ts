import { query } from './db'

export async function checkRateLimit(bucket:string, limit:number, windowSeconds:number) {
  const rows = await query<{ count:number }>(`insert into rate_limits(bucket,window_start,count) values($1,to_timestamp(floor(extract(epoch from now())/$2)*$2),1) on conflict(bucket,window_start) do update set count=rate_limits.count+1 returning count`, [bucket,windowSeconds])
  const elapsed = Math.floor(Date.now()/1000)%windowSeconds
  return { allowed:rows[0].count<=limit, retryAfter:windowSeconds-elapsed }
}

export async function peekRateLimit(bucket:string, limit:number, windowSeconds:number) {
  const rows = await query<{ count:number }>(`select count from rate_limits where bucket=$1 and window_start=to_timestamp(floor(extract(epoch from now())/$2)*$2)`, [bucket,windowSeconds])
  const elapsed = Math.floor(Date.now()/1000)%windowSeconds
  return { allowed:(rows[0]?.count ?? 0)<limit, retryAfter:windowSeconds-elapsed }
}

export async function recordRateLimitHit(bucket:string, windowSeconds:number) {
  await query(`insert into rate_limits(bucket,window_start,count) values($1,to_timestamp(floor(extract(epoch from now())/$2)*$2),1) on conflict(bucket,window_start) do update set count=rate_limits.count+1`, [bucket,windowSeconds])
}
