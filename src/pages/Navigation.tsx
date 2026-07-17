import { useState, useMemo, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import '../App.css';
import { LinkCard } from '../components/LinkCard';
import type { LinkItem } from '../components/LinkCard';
import { AddLinkModal } from '../components/AddLinkModal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Edit2, Plus, Trash2, LogOut, Cloud, RefreshCw, User as UserIcon } from 'lucide-react';
import initialData from '../data.json';
import { SortableLinkCard } from '../components/SortableLinkCard';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';

// A wrapper for the droppable category area
const CategoryDroppable: React.FC<{ category: string; children: React.ReactNode; isEditing: boolean }> = ({ category, children, isEditing }) => {
  const { setNodeRef } = useDroppable({
    id: category,
    disabled: !isEditing
  });
  return (
    <div ref={setNodeRef} className="links-grid" style={{ minHeight: isEditing ? '120px' : 'auto' }}>
      {children}
    </div>
  );
};

export default function Navigation() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [navData, setNavData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [activeCategoryForNewLink, setActiveCategoryForNewLink] = useState<number | null>(null);
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // --- Dnd-kit logic hooks MUST be before early returns ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (user) loadUserData();
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    try {
      const { data, error } = await supabase
        .from('user_nav_configs')
        .select('nav_data')
        .eq('user_id', user.id)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data && data.nav_data) {
        setNavData(data.nav_data);
      } else {
        setNavData(initialData);
        await saveUserData(initialData);
      }
      setSyncStatus('success');
      setDataLoaded(true);
    } catch (err) {
      console.error('Failed to load user data', err);
      setSyncStatus('error');
    }
  };

  const saveUserData = async (newData: any[]) => {
    if (!user) return;
    setNavData(newData);
    setSyncStatus('syncing');
    try {
      const { error } = await supabase
        .from('user_nav_configs')
        .upsert({
          user_id: user.id,
          nav_data: newData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
      setSyncStatus('success');
    } catch (err) {
      console.error('Failed to save user data', err);
      setSyncStatus('error');
    }
  };

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return navData;
    const query = searchQuery.toLowerCase();
    return navData.map(category => {
      const filteredLinks = category.links.filter((link: any) => 
        link.name.toLowerCase().includes(query) || link.desc.toLowerCase().includes(query)
      );
      return { ...category, links: filteredLinks };
    }).filter(category => category.links.length > 0 || category.category.toLowerCase().includes(query));
  }, [searchQuery, navData]);

  if (authLoading) return <div className="page-container" style={{ textAlign: 'center', marginTop: '5rem' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const handleDeleteLink = (catIdx: number, linkIdx: number) => {
    if (!window.confirm('确定要删除这个网站吗？')) return;
    const newData = [...navData];
    newData[catIdx].links.splice(linkIdx, 1);
    saveUserData(newData);
  };

  const handleDeleteCategory = (catIdx: number) => {
    if (!window.confirm('确定要删除整个分类及其下所有网站吗？')) return;
    const newData = [...navData];
    newData.splice(catIdx, 1);
    saveUserData(newData);
  };

  const handleAddCategory = () => {
    const name = window.prompt('请输入新分类名称:');
    if (name) {
      const newData = [...navData, { category: name, links: [] }];
      saveUserData(newData);
    }
  };

  const handleAddLink = (link: LinkItem) => {
    if (activeCategoryForNewLink === null) return;
    const newData = [...navData];
    newData[activeCategoryForNewLink].links.push(link);
    saveUserData(newData);
    setActiveCategoryForNewLink(null);
  };

  // --- Dnd-kit logic ---
  const isDragEnabled = isEditing && !searchQuery.trim();

  const findContainer = (id: string) => {
    if (navData.some(c => c.category === id)) return id;
    for (const cat of navData) {
      if (cat.links.some((l: any) => l.url === id)) return cat.category;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const overId = over?.id;
    if (!overId || active.id === overId) return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(overId as string);

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setNavData((prev) => {
      const activeCatIdx = prev.findIndex(c => c.category === activeContainer);
      const overCatIdx = prev.findIndex(c => c.category === overContainer);
      
      const activeItems = prev[activeCatIdx].links;
      const overItems = prev[overCatIdx].links;
      
      const activeIndex = activeItems.findIndex((l: any) => l.url === active.id);
      let overIndex = overItems.findIndex((l: any) => l.url === overId);
      
      if (overIndex === -1) overIndex = overItems.length;

      const newData = [...prev];
      newData[activeCatIdx] = { ...prev[activeCatIdx], links: [...activeItems] };
      newData[overCatIdx] = { ...prev[overCatIdx], links: [...overItems] };

      const [moved] = newData[activeCatIdx].links.splice(activeIndex, 1);
      newData[overCatIdx].links.splice(overIndex, 0, moved);

      return newData;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) {
      saveUserData(navData);
      return;
    }

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (activeContainer && overContainer && activeContainer === overContainer) {
      const catIdx = navData.findIndex(c => c.category === activeContainer);
      const activeIndex = navData[catIdx].links.findIndex((l: any) => l.url === active.id);
      const overIndex = navData[catIdx].links.findIndex((l: any) => l.url === over.id);

      if (activeIndex !== overIndex) {
        const newData = [...navData];
        newData[catIdx].links = arrayMove(newData[catIdx].links, activeIndex, overIndex);
        setNavData(newData);
        saveUserData(newData);
        return;
      }
    }
    
    saveUserData(navData);
  };

  const activeLink = activeDragId 
    ? navData.flatMap(c => c.links).find((l: any) => l.url === activeDragId) 
    : null;

  return (
    <div className="page-container">
      <header className="header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1>我的导航</h1>
          <div title="数据库同步状态" style={{ display: 'flex', alignItems: 'center', color: syncStatus === 'error' ? '#ef4444' : syncStatus === 'syncing' ? '#38bdf8' : '#22c55e' }}>
            {syncStatus === 'syncing' ? <RefreshCw size={18} className="spin" /> : <Cloud size={18} />}
          </div>
        </div>
        
        <div className="search-bar" style={{ margin: '0 auto', flex: 1, minWidth: '200px', maxWidth: '400px' }}>
          <input 
            type="text" 
            placeholder="搜索网站..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className={`btn ${isEditing ? '' : 'btn-secondary'}`} onClick={() => setIsEditing(!isEditing)} title="进入编辑模式">
            <Edit2 size={16} /> {isEditing ? '完成' : '编辑'}
          </button>
          <div style={{ width: '1px', height: '24px', background: 'var(--glass-border)', margin: '0 0.5rem' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>
            <UserIcon size={16} /> <span>{user.email?.split('@')[0]}</span>
          </div>
          <button className="btn btn-secondary" onClick={signOut} title="退出登录" style={{ padding: '0.5rem' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main style={{ minHeight: '50vh' }}>
        {!dataLoaded ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: '#94a3b8' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 1rem' }} />
            <p>正在加载您的专属导航...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: '#94a3b8' }}>
            <p>没有找到相关内容</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {filteredData.map((category, catIdx) => (
              <section key={category.category} className="category-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h2 className="category-title" style={{ marginBottom: 0 }}>{category.category}</h2>
                  {isEditing && (
                    <button onClick={() => handleDeleteCategory(catIdx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                
                <SortableContext 
                  items={category.links.map((l: any) => l.url)} 
                  strategy={rectSortingStrategy}
                >
                  <CategoryDroppable category={category.category} isEditing={isDragEnabled}>
                    {category.links.map((link: any, linkIdx: number) => (
                      <SortableLinkCard 
                        key={link.url}
                        id={link.url}
                        link={link}
                        isEditing={isEditing}
                        onDelete={() => handleDeleteLink(catIdx, linkIdx)}
                      />
                    ))}
                    {isEditing && (
                      <button 
                        onClick={() => setActiveCategoryForNewLink(catIdx)}
                        style={{
                          background: 'rgba(255,255,255,0.02)', border: '2px dashed var(--glass-border)',
                          borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', color: '#94a3b8', cursor: 'pointer',
                          minHeight: '100px', transition: 'all 0.2s'
                        }}
                      >
                        <Plus size={24} style={{ marginBottom: '0.5rem' }} />
                        <span>添加网站</span>
                      </button>
                    )}
                  </CategoryDroppable>
                </SortableContext>
              </section>
            ))}

            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
              {activeDragId && activeLink ? (
                <div style={{ transform: 'scale(1.05)' }}>
                  <LinkCard link={activeLink} isEditing={true} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {isEditing && dataLoaded && (
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <button className="btn btn-secondary" onClick={handleAddCategory}>
              <Plus size={16} /> 新增分类
            </button>
          </div>
        )}
      </main>

      <AddLinkModal
        isOpen={activeCategoryForNewLink !== null}
        onClose={() => setActiveCategoryForNewLink(null)}
        onSave={handleAddLink}
      />
    </div>
  );
}
