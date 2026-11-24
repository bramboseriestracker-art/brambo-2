import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import FollowButton from './FollowButton.jsx';

export default function UserRow({ u }) {
  return (
    <li className="user-row">
      <Link to={`/u/${u.username}`} className="user-link"><Avatar user={u} /><span><b>{u.username}</b><small>{u.bid} | {u.followersCount} follower{u.followersCount === 1 ? '' : 's'}</small>{u.activity && (u.activity.logs + u.activity.reviews + u.activity.ratings > 0) && <span className="activity-tag">{[u.activity.logs && `${u.activity.logs} season${u.activity.logs === 1 ? '' : 's'} logged`, u.activity.reviews && `${u.activity.reviews} review${u.activity.reviews === 1 ? '' : 's'}`, u.activity.ratings && `${u.activity.ratings} rating${u.activity.ratings === 1 ? '' : 's'}`].filter(Boolean).join(' | ')} this month</span>}</span></Link>
      {!u.isMe && <FollowButton handle={u.username} following={u.isFollowing} />}
    </li>
  );
}
