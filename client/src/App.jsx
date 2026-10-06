import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Layout from './components/Layout.jsx';
import { ToastProvider } from './components/Toasts.jsx';
import { Spinner } from './components/ui.jsx';
import Auth from './pages/Auth.jsx';
import Feed from './pages/Feed.jsx';
import NewPost from './pages/NewPost.jsx';
import Explore from './pages/Explore.jsx';
import TrailDetail from './pages/TrailDetail.jsx';
import ForYou from './pages/ForYou.jsx';
import Outings from './pages/Outings.jsx';
import OutingNew from './pages/OutingNew.jsx';
import OutingDetail from './pages/OutingDetail.jsx';
import ChatList from './pages/ChatList.jsx';
import ChatThread from './pages/ChatThread.jsx';
import Profile from './pages/Profile.jsx';
import People from './pages/People.jsx';
import Achievements from './pages/Achievements.jsx';
import Settings from './pages/Settings.jsx';
import Routes_ from './pages/Routes.jsx';
import RouteBuilder from './pages/RouteBuilder.jsx';
import RouteDetail from './pages/RouteDetail.jsx';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen"><Spinner /></div>;
  if (!user) {
    return (
      <Routes>
        <Route path="/signup" element={<Auth mode="signup" />} />
        <Route path="*" element={<Auth mode="login" />} />
      </Routes>
    );
  }
  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Feed />} />
          <Route path="post/new" element={<NewPost />} />
          <Route path="explore" element={<Explore />} />
          <Route path="trails/:slug" element={<TrailDetail />} />
          <Route path="for-you" element={<ForYou />} />
          <Route path="routes" element={<Routes_ />} />
          <Route path="routes/new" element={<RouteBuilder />} />
          <Route path="routes/:id" element={<RouteDetail />} />
          <Route path="hikes" element={<Outings />} />
          <Route path="hikes/new" element={<OutingNew />} />
          <Route path="hikes/:id" element={<OutingDetail />} />
          <Route path="chat" element={<ChatList />} />
          <Route path="chat/:id" element={<ChatThread />} />
          <Route path="u/:username" element={<Profile />} />
          <Route path="people" element={<People />} />
          <Route path="achievements" element={<Achievements />} />
          <Route path="settings" element={<Settings />} />
          <Route path="signup" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
