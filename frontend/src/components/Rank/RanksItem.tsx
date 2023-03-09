import { Link } from 'react-router-dom';

interface RanksItemProps {
  id: number;
  rank: number;
  ladder: number;
  children: React.ReactNode;
}

function RanksItem({ id, rank, ladder, children }: RanksItemProps) {
  return (
    <Link to={`/profile/${id}`} className="ranksItem selectNone">
      <p>{rank} 등</p>
      {children}
      <p>{ladder}</p>
    </Link>
  );
}

export default RanksItem;
