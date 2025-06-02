import * as React from "react";
import { convertToLatestVCFPhotoFormat } from "src/util/avatarActions";

interface AvatarProps {
	photoUrl?: string;
	firstName: string;
	lastName: string;
}

export const Avatar = (props: AvatarProps) => {
	const [hasImageError, setHasImageError] = React.useState(false);
	const initials = `${props.firstName.charAt(0).toUpperCase()}${props.lastName.charAt(0).toUpperCase()}`;

  React.useEffect(() => {
    setHasImageError(false);
  }, [props.photoUrl]);

  return (
		<div className="avatar-initials">
			{props.photoUrl && !hasImageError ? (
				<img
					src={convertToLatestVCFPhotoFormat(props.photoUrl)}
					onError={() => setHasImageError(true)}
				/>
			) : (
				<svg
					width="100%"
					height="100%"
					viewBox="0 0 100 100"
					xmlns="http://www.w3.org/2000/svg"
				>
					<text
						x="50%"
						y="50%"
						textAnchor="middle"
						dy=".3em"
						fontSize="30"
					>
						{initials}
					</text>
				</svg>
			)}
		</div>
	);
};

export default Avatar;
