import { Link, useNavigate } from 'react-router-dom';

interface RanksItemProps {
  id: number;
  rank: number;
  ladder: number;
  children: React.ReactNode;
}

function RanksItem({ id, rank, ladder, children }: RanksItemProps) {
  const nav = useNavigate();
  return (
    <div onClick={() => nav(`/profile/${id}`)} className="ranksItem selectNone">
      <p>{rank} 등</p>
      {children}
      <p>{ladder}</p>
    </div>
  );
}

export default RanksItem;
