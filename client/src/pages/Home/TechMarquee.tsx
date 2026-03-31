import { TechIcon } from './constants';

type TechMarqueeProps = {
  icons: TechIcon[];
};

const TechMarquee = ({ icons }: TechMarqueeProps) => {
  return (
    <div className="mt-2 flex flex-col items-center gap-4">
      <p className="text-sm font-semibold tracking-[0.2em] text-slate-600 uppercase sm:text-base">
        Built with
      </p>

      <div className="tech-marquee h-16">
        <div className="tech-marquee-track h-16">
          {icons.map(icon => (
            <img
              key={icon.alt}
              src={icon.src}
              alt={icon.alt}
              className="h-10 w-auto object-contain opacity-90 sm:h-11"
            />
          ))}
        </div>
        <div className="tech-marquee-track h-16" aria-hidden="true">
          {icons.map(icon => (
            <img
              key={`dup-${icon.alt}`}
              src={icon.src}
              alt=""
              className="h-10 w-auto object-contain opacity-90 sm:h-11"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TechMarquee;
