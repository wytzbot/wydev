import { Menu as MenuIcon, Search, Share2 } from "lucide-react";

export default function TopBar({ user, onMenu, onSearch, onShare, onAvatar }) {
  return (
    <header className="topbar">
      <button className="topbarIcon" aria-label="Open menu" onClick={onMenu}>
        <MenuIcon size={20} />
      </button>
      <span className="topbarBrand">WyteLab</span>
      <button className="topbarIcon" aria-label="Search" onClick={onSearch}>
        <Search size={19} />
      </button>
      <button className="topbarIcon" aria-label="Share WyteLab" onClick={onShare}><Share2 size={18} /></button>
      <button className="topbarAvatar" aria-label="Account" onClick={onAvatar}>
        {user?.avatar ? (
          <img src={user.avatar} alt="" />
        ) : (
          <span className="avatarFallback">{(user?.login || "?")[0].toUpperCase()}</span>
        )}
      </button>
    </header>
  );
}
