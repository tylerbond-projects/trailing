import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import PostCard from '../components/PostCard.jsx';
import { Spinner, Empty } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

export default function Feed() {
  const [posts, setPosts] = useState(null);
  const [discover, setDiscover] = useState([]);
  const [more, setMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    api('/posts/feed').then(({ posts }) => {
      setPosts(posts);
      setMore(posts.length === 20);
      if (posts.length < 3) api('/posts/discover').then((d) => setDiscover(d.posts));
    });
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    const last = posts[posts.length - 1];
    const { posts: next } = await api(`/posts/feed?before=${encodeURIComponent(last.created_at)}`);
    setPosts([...posts, ...next]);
    setMore(next.length === 20);
    setLoadingMore(false);
  }

  const remove = (id) => setPosts((p) => p.filter((x) => x.id !== id));
  if (!posts) return <Spinner />;
  const seen = new Set(posts.map((p) => p.id));

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Feed</h1>
        <Link to="/post/new" className="btn primary"><Icon name="plus" size={17} /> Share</Link>
      </div>
      {posts.length === 0 && (
        <Empty icon="boot" title="Your feed is quiet">
          Follow other hikers and runners, or <Link to="/post/new">share your first activity</Link>.
        </Empty>
      )}
      {posts.map((p) => <PostCard key={p.id} post={p} onDelete={remove} />)}
      {more && posts.length > 0 && <button className="btn block" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</button>}
      {discover.filter((p) => !seen.has(p.id)).length > 0 && (
        <>
          <h2 className="section-title">Discover the community</h2>
          {discover.filter((p) => !seen.has(p.id)).map((p) => <PostCard key={p.id} post={p} />)}
          <Link to="/people" className="btn block">Find people to follow</Link>
        </>
      )}
    </div>
  );
}
