import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

interface MenuItem {
  key: string;
  label: string;
  icon: string;
  path?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    key: 'tools',
    label: '工具管理',
    icon: '🔧',
    children: [
      { key: 'tools-automation', label: 'Web自动化巡检', icon: '🤖', path: '/' },
      { key: 'tools-responsive', label: '移动端/响应式测试', icon: '📱', path: '/tools/responsive' },
      { key: 'tools-test-points', label: '测试点提取', icon: '📝', path: '/tools/test-points' },
      { key: 'tools-patrol', label: '日常巡检', icon: '🔍', path: '/tools/patrol' },
      { key: 'tools-monitor', label: '监控工具', icon: '📡', path: '/tools/monitor' },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['tools']); // 默认展开工具管理
  const location = useLocation();

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const toggleExpand = (key: string) => {
    if (expandedKeys.includes(key)) {
      setExpandedKeys(expandedKeys.filter((k) => k !== key));
    } else {
      setExpandedKeys([...expandedKeys, key]);
    }
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path;
  };

  const renderMenuItem = (item: MenuItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedKeys.includes(item.key);
    const active = isActive(item.path);

    if (hasChildren) {
      return (
        <div key={item.key} className="menu-item-group">
          <div
            className={`menu-item ${isExpanded ? 'expanded' : ''}`}
            onClick={() => toggleExpand(item.key)}
          >
            <span className="menu-icon">{item.icon}</span>
            {!collapsed && (
              <>
                <span className="menu-label">{item.label}</span>
                <span className="menu-arrow">{isExpanded ? '▼' : '▶'}</span>
              </>
            )}
          </div>
          {isExpanded && !collapsed && (
            <div className="submenu">
              {item.children!.map((child) => (
                <Link
                  key={child.key}
                  to={child.path || '#'}
                  className={`menu-item submenu-item ${isActive(child.path) ? 'active' : ''}`}
                >
                  <span className="menu-icon">{child.icon}</span>
                  <span className="menu-label">{child.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.key}
        to={item.path || '#'}
        className={`menu-item ${active ? 'active' : ''}`}
      >
        <span className="menu-icon">{item.icon}</span>
        {!collapsed && <span className="menu-label">{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-icon">DTC</span>
          {!collapsed && <span className="logo-text">测试工具</span>}
        </div>
        <button className="collapse-btn" onClick={toggleCollapse}>
          {collapsed ? '☰' : '✕'}
        </button>
      </div>
      <div className="sidebar-menu">{menuItems.map(renderMenuItem)}</div>
    </div>
  );
};
