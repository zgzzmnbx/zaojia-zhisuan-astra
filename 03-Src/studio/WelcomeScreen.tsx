import {ClassicWelcomeScreen,type WelcomeProps} from './ClassicWelcomeScreen';
import {WelcomeHeroScreen} from './WelcomeHeroScreen';
import {useWelcomeStyle} from './welcome-preferences';
export {readSkipWelcome} from './ClassicWelcomeScreen';
export function WelcomeScreen(props:WelcomeProps){
 const {style}=useWelcomeStyle();
 return style==='classic'?<ClassicWelcomeScreen {...props}/>:<WelcomeHeroScreen {...props}/>;
}
